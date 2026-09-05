-- Run once in the Supabase SQL Editor before using the "Other" platform option.
-- Existing Instagram and TikTok values remain valid.

begin;

alter table public.smm_timeline_items
  drop constraint if exists smm_timeline_items_platforms_check;

alter table public.smm_timeline_items
  add constraint smm_timeline_items_platforms_check
  check (
    coalesce(platforms, '{}'::text[])
      <@ array['Instagram', 'TikTok', 'Other']::text[]
  );

commit;

-- Verification: the definition must list Instagram, TikTok, and Other.
select
  conname,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.smm_timeline_items'::regclass
  and conname = 'smm_timeline_items_platforms_check';
