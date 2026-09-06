-- Permanent SMM client deletion.
-- Run this file in the Supabase SQL Editor before using Delete Client.
-- Invoice snapshots are preserved; their client_id becomes null through the
-- existing smm_invoices foreign key while client_name remains in the snapshot.

create or replace function public.current_user_can_manage_smm_timeline()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.employees
     where id = (select auth.uid())
       and status = 'Aktif'
       and role in ('Founder', 'Administrator')
  );
$$;

revoke all on function public.current_user_can_manage_smm_timeline() from public;
grant execute on function public.current_user_can_manage_smm_timeline() to authenticated;

alter table public.smm_clients enable row level security;
alter table public.smm_timelines enable row level security;
alter table public.smm_timeline_items enable row level security;

grant select, delete on table public.smm_clients to authenticated;
grant select, delete on table public.smm_timelines to authenticated;
grant select, delete on table public.smm_timeline_items to authenticated;

-- The UI filters active clients itself. This policy lets operational roles find
-- legacy inactive rows so a formerly deleted name can be cleared and reused.
drop policy if exists "Operational roles can read all SMM clients for reset" on public.smm_clients;
create policy "Operational roles can read all SMM clients for reset"
  on public.smm_clients for select to authenticated
  using (public.current_user_can_manage_smm_timeline());

drop policy if exists "Operational roles can read SMM timelines for deletion" on public.smm_timelines;
create policy "Operational roles can read SMM timelines for deletion"
  on public.smm_timelines for select to authenticated
  using (public.current_user_can_manage_smm_timeline());

drop policy if exists "Operational roles can read SMM timeline items for deletion" on public.smm_timeline_items;
create policy "Operational roles can read SMM timeline items for deletion"
  on public.smm_timeline_items for select to authenticated
  using (public.current_user_can_manage_smm_timeline());

drop policy if exists "Operational roles can delete SMM clients" on public.smm_clients;
create policy "Operational roles can delete SMM clients"
  on public.smm_clients for delete to authenticated
  using (public.current_user_can_manage_smm_timeline());

drop policy if exists "Operational roles can delete SMM timelines" on public.smm_timelines;
create policy "Operational roles can delete SMM timelines"
  on public.smm_timelines for delete to authenticated
  using (public.current_user_can_manage_smm_timeline());

drop policy if exists "Operational roles can delete SMM timeline items" on public.smm_timeline_items;
create policy "Operational roles can delete SMM timeline items"
  on public.smm_timeline_items for delete to authenticated
  using (public.current_user_can_manage_smm_timeline());

create or replace function public.delete_smm_client(target_client_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_client_name text;
  deleted_timeline_count integer;
  deleted_item_count integer;
begin
  if not public.current_user_can_manage_smm_timeline() then
    raise exception 'Only Founder or Administrator can delete SMM clients'
      using errcode = '42501';
  end if;

  select name
    into deleted_client_name
    from public.smm_clients
   where id = target_client_id;

  if deleted_client_name is null then
    raise exception 'SMM client not found'
      using errcode = 'P0002';
  end if;

  delete from public.smm_timeline_items
   where timeline_id in (
     select id
       from public.smm_timelines
      where client_id = target_client_id
   );
  get diagnostics deleted_item_count = row_count;

  delete from public.smm_timelines
   where client_id = target_client_id;
  get diagnostics deleted_timeline_count = row_count;

  delete from public.smm_clients
   where id = target_client_id;

  if not found then
    raise exception 'SMM client could not be deleted'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'client_name', deleted_client_name,
    'deleted_timelines', deleted_timeline_count,
    'deleted_items', deleted_item_count
  );
end;
$$;

revoke all on function public.delete_smm_client(uuid) from public;
grant execute on function public.delete_smm_client(uuid) to authenticated;

-- Creates/selects a client and the current Jakarta-month timeline atomically.
-- Inactive records left by the previous soft-delete behavior are permanently
-- cleared first, including all matching case/spacing variants, so the name can
-- start again with a fresh client id and empty timeline.
create or replace function public.create_smm_client_timeline(target_client_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text;
  current_month smallint;
  current_year integer;
  client_record public.smm_clients%rowtype;
  timeline_record public.smm_timelines%rowtype;
  reused_client boolean := false;
  reset_client boolean := false;
begin
  if not public.current_user_can_manage_smm_timeline() then
    raise exception 'Only Founder or Administrator can add SMM clients'
      using errcode = '42501';
  end if;

  clean_name := regexp_replace(btrim(coalesce(target_client_name, '')), '\s+', ' ', 'g');
  if clean_name = '' then
    raise exception 'Client name is required'
      using errcode = '22023';
  end if;

  current_month := extract(month from timezone('Asia/Jakarta', now()))::smallint;
  current_year := extract(year from timezone('Asia/Jakarta', now()))::integer;
  perform pg_advisory_xact_lock(hashtext(lower(clean_name)));

  select *
    into client_record
    from public.smm_clients
   where active = true
     and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(clean_name)
   limit 1;

  if found then
    reused_client := true;
  else
    if exists (
      select 1
        from public.smm_clients
       where active = false
         and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(clean_name)
    ) then
      reset_client := true;

      delete from public.smm_timeline_items
       where timeline_id in (
         select timeline.id
           from public.smm_timelines as timeline
           join public.smm_clients as client on client.id = timeline.client_id
          where client.active = false
            and lower(regexp_replace(btrim(client.name), '\s+', ' ', 'g')) = lower(clean_name)
       );

      delete from public.smm_timelines
       where client_id in (
         select id
           from public.smm_clients
          where active = false
            and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(clean_name)
       );

      delete from public.smm_clients
       where active = false
         and lower(regexp_replace(btrim(name), '\s+', ' ', 'g')) = lower(clean_name);
    end if;

    insert into public.smm_clients (name, active, created_by)
    values (clean_name, true, (select auth.uid()))
    returning * into client_record;
  end if;

  select *
    into timeline_record
    from public.smm_timelines
   where client_id = client_record.id
     and month = current_month
     and year = current_year
   limit 1;

  if not found then
    insert into public.smm_timelines (
      client_id,
      month,
      year,
      status,
      created_by
    ) values (
      client_record.id,
      current_month,
      current_year,
      'Draft',
      (select auth.uid())
    )
    returning * into timeline_record;
  end if;

  return jsonb_build_object(
    'client', to_jsonb(client_record),
    'timeline', to_jsonb(timeline_record),
    'reused', reused_client,
    'reset', reset_client
  );
end;
$$;

revoke all on function public.create_smm_client_timeline(text) from public;
grant execute on function public.create_smm_client_timeline(text) to authenticated;
