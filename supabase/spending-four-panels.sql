-- Four-panel Spending upgrade: Studio, Cash, Attire/Background, and Evoto.
-- Run once in the Supabase SQL Editor before using the two new categories.

alter table public.spendings
  add column if not exists evoto_direction text,
  add column if not exists evoto_credits numeric(14, 2) not null default 0,
  add column if not exists evoto_credit_rate numeric(14, 2) not null default 0;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'spendings'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%category%'
  loop
    execute format('alter table public.spendings drop constraint %I', constraint_name);
  end loop;
end;
$$;

update public.spendings
   set category = case
     when lower(btrim(category)) in ('studio expense', 'studio expenses') then 'expense'
     when lower(btrim(category)) in ('cash spending', 'cash movement') then 'cash'
     when lower(btrim(category)) in ('attire / background', 'attire/background', 'background') then 'attire'
     when lower(btrim(category)) = 'evoto balance' then 'evoto'
     else lower(btrim(category))
   end;

alter table public.spendings
  drop constraint if exists spendings_category_v2_check,
  drop constraint if exists spendings_evoto_direction_check,
  drop constraint if exists spendings_evoto_credits_check,
  drop constraint if exists spendings_evoto_credit_rate_check;

alter table public.spendings
  add constraint spendings_category_v2_check
    check (lower(category) in ('expense', 'cash', 'attire', 'evoto')),
  add constraint spendings_evoto_direction_check
    check (evoto_direction is null or evoto_direction in ('In', 'Out')),
  add constraint spendings_evoto_credits_check
    check (evoto_credits >= 0),
  add constraint spendings_evoto_credit_rate_check
    check (evoto_credit_rate >= 0);

create table if not exists public.spending_settings (
  id smallint primary key default 1 check (id = 1),
  evoto_credit_rate numeric(14, 2) not null default 0 check (evoto_credit_rate >= 0),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.spending_settings
  alter column updated_by set default auth.uid();

insert into public.spending_settings (id, evoto_credit_rate)
values (1, 0)
on conflict (id) do nothing;

create or replace function public.set_spending_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

drop trigger if exists spending_settings_set_updated_at on public.spending_settings;
create trigger spending_settings_set_updated_at
before update on public.spending_settings
for each row execute function public.set_spending_settings_updated_at();

create or replace function public.current_user_can_manage_spending()
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

revoke all on function public.set_spending_settings_updated_at() from public;
revoke all on function public.current_user_can_manage_spending() from public;
grant execute on function public.current_user_can_manage_spending() to authenticated;

alter table public.spending_settings enable row level security;
revoke all on table public.spending_settings from anon, authenticated;
grant select, insert, update on table public.spending_settings to authenticated;

drop policy if exists "Operational roles can read spending settings" on public.spending_settings;
create policy "Operational roles can read spending settings"
  on public.spending_settings for select to authenticated
  using ((select public.current_user_can_manage_spending()));

drop policy if exists "Operational roles can create spending settings" on public.spending_settings;
create policy "Operational roles can create spending settings"
  on public.spending_settings for insert to authenticated
  with check (
    id = 1
    and (select public.current_user_can_manage_spending())
  );

drop policy if exists "Operational roles can update spending settings" on public.spending_settings;
create policy "Operational roles can update spending settings"
  on public.spending_settings for update to authenticated
  using ((select public.current_user_can_manage_spending()))
  with check (id = 1 and (select public.current_user_can_manage_spending()));

comment on table public.spending_settings is 'Operational settings for Spending, including the Evoto credit rate.';
