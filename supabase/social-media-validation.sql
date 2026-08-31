-- Read-only validation setelah social-media.sql dijalankan.
select
  to_regclass('public.social_accounts') is not null as social_accounts,
  to_regclass('public.social_posts') is not null as social_posts,
  to_regclass('public.social_comments') is not null as social_comments,
  to_regclass('public.social_replies') is not null as social_replies,
  to_regclass('public.social_sync_runs') is not null as social_sync_runs,
  to_regclass('public.social_inbox') is not null as social_inbox;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'social_accounts',
    'social_posts',
    'social_comments',
    'social_replies',
    'social_sync_runs'
  )
order by c.relname;

select public.social_inbox_summary() as empty_or_current_summary;

-- Data Finance harus tetap ada; cocokkan angka ini dengan hasil preflight/backup.
select
  (select count(*) from public.customers) as customers,
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.transactions) as transactions,
  (select count(*) from public.employees) as employees;
