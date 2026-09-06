-- Founder-only employee payslip archive.
-- Run once in the Supabase SQL Editor before opening /employee-payslips.

create extension if not exists pgcrypto;

create table if not exists public.employee_payslips (
  id uuid primary key default gen_random_uuid(),
  payslip_number text not null unique,
  brand_name text not null check (brand_name in ('PLUNO STUDIO', 'VANGUENA')),
  employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  position text not null,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  base_salary numeric(14,2) not null default 0 check (base_salary >= 0),
  deduction numeric(14,2) not null default 0 check (deduction >= 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  notes text not null default '',
  generated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);

create index if not exists employee_payslips_generated_at_idx on public.employee_payslips (generated_at desc);
create index if not exists employee_payslips_employee_id_idx on public.employee_payslips (employee_id);
create index if not exists employee_payslips_period_idx on public.employee_payslips (period desc);

create or replace function public.set_employee_payslip_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  number_prefix text;
  next_number integer;
begin
  if new.payslip_number is not null and btrim(new.payslip_number) <> '' then
    return new;
  end if;
  number_prefix := case when new.brand_name = 'VANGUENA' then 'VGN-PAY-' else 'PLN-PAY-' end || replace(new.period, '-', '') || '-';
  perform pg_advisory_xact_lock(hashtext(number_prefix));
  select coalesce(max(((regexp_match(payslip_number, '([0-9]+)$'))[1])::integer), 0) + 1
    into next_number
    from public.employee_payslips
   where payslip_number like number_prefix || '%';
  new.payslip_number := number_prefix || lpad(next_number::text, 3, '0');
  return new;
end;
$$;

drop trigger if exists employee_payslips_set_number on public.employee_payslips;
create trigger employee_payslips_set_number before insert on public.employee_payslips
for each row execute function public.set_employee_payslip_number();

revoke all on function public.set_employee_payslip_number() from public;

create or replace function public.current_user_can_manage_employee_payslips()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees
     where id = (select auth.uid())
       and status = 'Aktif'
       and role = 'Founder'
  );
$$;

revoke all on function public.current_user_can_manage_employee_payslips() from public;
grant execute on function public.current_user_can_manage_employee_payslips() to authenticated;

alter table public.employee_payslips enable row level security;
revoke all on table public.employee_payslips from anon, authenticated;
grant select, insert, delete on table public.employee_payslips to authenticated;

drop policy if exists "Founder can read employee payslips" on public.employee_payslips;
create policy "Founder can read employee payslips" on public.employee_payslips
for select to authenticated using ((select public.current_user_can_manage_employee_payslips()));

drop policy if exists "Founder can create employee payslips" on public.employee_payslips;
create policy "Founder can create employee payslips" on public.employee_payslips
for insert to authenticated with check (
  created_by = (select auth.uid())
  and (select public.current_user_can_manage_employee_payslips())
);

drop policy if exists "Founder can delete employee payslips" on public.employee_payslips;
create policy "Founder can delete employee payslips" on public.employee_payslips
for delete to authenticated using ((select public.current_user_can_manage_employee_payslips()));

comment on table public.employee_payslips is 'Founder-only immutable employee salary slip snapshots.';
