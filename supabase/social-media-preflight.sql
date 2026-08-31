-- Read-only preflight. Tidak mengubah data apa pun.
select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.transactions) as transactions,
  (select count(*) from public.employees) as employees,
  to_regclass('public.social_accounts') is not null as social_accounts_exists,
  to_regclass('public.social_comments') is not null as social_comments_exists;

select
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'employees'
  and column_name in ('id', 'role', 'status')
order by column_name;
