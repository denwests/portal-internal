-- Social Media Management invoice generator.
-- Run this file once in the Supabase SQL Editor before opening /smm-invoice.

create extension if not exists pgcrypto;

create table if not exists public.smm_invoice_settings (
  id smallint primary key default 1 check (id = 1),
  invoice_title text not null default 'Invoice',
  default_description text not null default '',
  default_amount numeric(14, 2) not null default 0 check (default_amount >= 0),
  default_information text not null default '',
  payment_information text not null default '',
  brand_name text not null default 'Vanguena',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.smm_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid references public.smm_clients(id) on delete set null,
  client_name text not null,
  invoice_date date not null,
  title text not null,
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  information text not null default '',
  payment_information text not null default '',
  brand_name text not null,
  generated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

-- Keeps this setup file compatible with the first SMM Invoice draft.
alter table public.smm_invoice_settings drop column if exists parent_brand;
alter table public.smm_invoices drop column if exists parent_brand;
alter table public.smm_invoices drop column if exists billing_period;

update public.smm_invoice_settings
   set invoice_title = 'Invoice',
       default_description = ''
 where id = 1
   and invoice_title = 'Social Media Management Invoice'
   and default_description = 'Social Media Management';

create index if not exists smm_invoices_generated_at_idx
  on public.smm_invoices (generated_at desc);

create index if not exists smm_invoices_client_id_idx
  on public.smm_invoices (client_id);

create or replace function public.set_smm_invoice_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists smm_invoice_settings_set_updated_at on public.smm_invoice_settings;
create trigger smm_invoice_settings_set_updated_at
before update on public.smm_invoice_settings
for each row execute function public.set_smm_invoice_updated_at();

create or replace function public.set_smm_invoice_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  number_prefix text;
  next_number integer;
begin
  if new.invoice_number is not null and btrim(new.invoice_number) <> '' then
    return new;
  end if;

  number_prefix := 'VGN-' || to_char(new.invoice_date, 'YYYYMM') || '-';
  perform pg_advisory_xact_lock(hashtext(number_prefix));

  select coalesce(max(((regexp_match(invoice_number, '([0-9]+)$'))[1])::integer), 0) + 1
    into next_number
    from public.smm_invoices
   where invoice_number like number_prefix || '%';

  new.invoice_number := number_prefix || lpad(next_number::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists smm_invoices_set_number on public.smm_invoices;
create trigger smm_invoices_set_number
before insert on public.smm_invoices
for each row execute function public.set_smm_invoice_number();

create or replace function public.current_user_can_manage_smm_invoice()
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

revoke all on function public.current_user_can_manage_smm_invoice() from public;
grant execute on function public.current_user_can_manage_smm_invoice() to authenticated;

alter table public.smm_invoice_settings enable row level security;
alter table public.smm_invoices enable row level security;

revoke all on table public.smm_invoice_settings from anon, authenticated;
revoke all on table public.smm_invoices from anon, authenticated;

grant select, insert, update on table public.smm_invoice_settings to authenticated;
grant select, insert, delete on table public.smm_invoices to authenticated;

drop policy if exists "Operational roles can read SMM invoice settings" on public.smm_invoice_settings;
create policy "Operational roles can read SMM invoice settings"
  on public.smm_invoice_settings for select to authenticated
  using (public.current_user_can_manage_smm_invoice());

drop policy if exists "Operational roles can create SMM invoice settings" on public.smm_invoice_settings;
create policy "Operational roles can create SMM invoice settings"
  on public.smm_invoice_settings for insert to authenticated
  with check (id = 1 and public.current_user_can_manage_smm_invoice());

drop policy if exists "Operational roles can update SMM invoice settings" on public.smm_invoice_settings;
create policy "Operational roles can update SMM invoice settings"
  on public.smm_invoice_settings for update to authenticated
  using (public.current_user_can_manage_smm_invoice())
  with check (id = 1 and public.current_user_can_manage_smm_invoice());

drop policy if exists "Operational roles can read SMM invoices" on public.smm_invoices;
create policy "Operational roles can read SMM invoices"
  on public.smm_invoices for select to authenticated
  using (public.current_user_can_manage_smm_invoice());

drop policy if exists "Operational roles can create SMM invoices" on public.smm_invoices;
create policy "Operational roles can create SMM invoices"
  on public.smm_invoices for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.current_user_can_manage_smm_invoice()
  );

drop policy if exists "Operational roles can delete SMM invoices" on public.smm_invoices;
create policy "Operational roles can delete SMM invoices"
  on public.smm_invoices for delete to authenticated
  using (public.current_user_can_manage_smm_invoice());

insert into public.smm_invoice_settings (id)
values (1)
on conflict (id) do nothing;

comment on table public.smm_invoices is
  'SMM invoice snapshots. Settings changes only affect future invoices; operational roles may delete incorrect records.';
