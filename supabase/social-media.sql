begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.social_platform as enum ('instagram', 'threads', 'tiktok');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.social_comment_status as enum (
    'new',
    'read',
    'replied',
    'resolved',
    'spam'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  platform public.social_platform not null,
  platform_account_id text not null,
  username text,
  display_name text,
  enabled boolean not null default true,
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_account_id)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  platform public.social_platform not null,
  platform_post_id text not null,
  caption text,
  permalink text,
  published_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_post_id)
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.social_accounts(id) on delete cascade,
  post_id uuid not null references public.social_posts(id) on delete cascade,
  platform public.social_platform not null,
  platform_post_id text not null,
  platform_comment_id text not null,
  platform_parent_id text,
  author_platform_id text,
  author_username text,
  author_name text,
  message text not null default '',
  commented_at timestamptz not null,
  status public.social_comment_status not null default 'new',
  is_owned_reply boolean not null default false,
  can_reply boolean not null default true,
  reply_count integer not null default 0 check (reply_count >= 0),
  read_at timestamptz,
  read_by uuid references auth.users(id) on delete set null,
  replied_at timestamptz,
  replied_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_comment_id)
);

create table if not exists public.social_replies (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.social_comments(id) on delete cascade,
  platform public.social_platform not null,
  platform_reply_id text,
  idempotency_key uuid not null unique,
  message text not null check (char_length(trim(message)) between 1 and 2200),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_sync_runs (
  id uuid primary key default gen_random_uuid(),
  platform public.social_platform not null,
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'cron', 'webhook')),
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  posts_count integer not null default 0 check (posts_count >= 0),
  comments_count integer not null default 0 check (comments_count >= 0),
  error_message text,
  triggered_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists social_comments_queue_idx
  on public.social_comments (status, commented_at desc)
  where is_owned_reply = false;

create index if not exists social_comments_platform_queue_idx
  on public.social_comments (platform, status, commented_at desc)
  where is_owned_reply = false;

create index if not exists social_comments_post_idx
  on public.social_comments (post_id, commented_at desc);

create index if not exists social_posts_account_idx
  on public.social_posts (account_id, published_at desc);

create index if not exists social_replies_comment_idx
  on public.social_replies (comment_id, created_at desc);

create index if not exists social_sync_runs_started_idx
  on public.social_sync_runs (started_at desc);

create or replace function public.set_social_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_accounts_set_updated_at on public.social_accounts;
create trigger social_accounts_set_updated_at
before update on public.social_accounts
for each row execute function public.set_social_updated_at();

drop trigger if exists social_posts_set_updated_at on public.social_posts;
create trigger social_posts_set_updated_at
before update on public.social_posts
for each row execute function public.set_social_updated_at();

drop trigger if exists social_comments_set_updated_at on public.social_comments;
create trigger social_comments_set_updated_at
before update on public.social_comments
for each row execute function public.set_social_updated_at();

drop trigger if exists social_replies_set_updated_at on public.social_replies;
create trigger social_replies_set_updated_at
before update on public.social_replies
for each row execute function public.set_social_updated_at();

create or replace function public.current_user_can_manage_social()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where id = auth.uid()
      and status = 'Aktif'
      and role in ('Founder', 'Administrator')
  );
$$;

revoke all on function public.current_user_can_manage_social() from public;
grant execute on function public.current_user_can_manage_social() to authenticated;

alter table public.social_accounts enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_replies enable row level security;
alter table public.social_sync_runs enable row level security;

drop policy if exists "Operational roles can read social accounts" on public.social_accounts;
create policy "Operational roles can read social accounts"
  on public.social_accounts
  for select
  to authenticated
  using (public.current_user_can_manage_social());

drop policy if exists "Operational roles can read social posts" on public.social_posts;
create policy "Operational roles can read social posts"
  on public.social_posts
  for select
  to authenticated
  using (public.current_user_can_manage_social());

drop policy if exists "Operational roles can read social comments" on public.social_comments;
create policy "Operational roles can read social comments"
  on public.social_comments
  for select
  to authenticated
  using (public.current_user_can_manage_social());

drop policy if exists "Operational roles can read social replies" on public.social_replies;
create policy "Operational roles can read social replies"
  on public.social_replies
  for select
  to authenticated
  using (public.current_user_can_manage_social());

drop policy if exists "Operational roles can read social sync runs" on public.social_sync_runs;
create policy "Operational roles can read social sync runs"
  on public.social_sync_runs
  for select
  to authenticated
  using (public.current_user_can_manage_social());

revoke insert, update, delete on public.social_accounts from authenticated;
revoke insert, update, delete on public.social_posts from authenticated;
revoke insert, update, delete on public.social_comments from authenticated;
revoke insert, update, delete on public.social_replies from authenticated;
revoke insert, update, delete on public.social_sync_runs from authenticated;

grant select on public.social_accounts to authenticated;
grant select on public.social_posts to authenticated;
grant select on public.social_comments to authenticated;
grant select on public.social_replies to authenticated;
grant select on public.social_sync_runs to authenticated;

drop view if exists public.social_inbox;
create view public.social_inbox
with (security_invoker = true)
as
select
  c.id,
  c.account_id,
  c.post_id,
  c.platform,
  c.platform_post_id,
  c.platform_comment_id,
  c.platform_parent_id,
  c.author_platform_id,
  c.author_username,
  c.author_name,
  c.message,
  c.commented_at,
  c.status,
  c.can_reply,
  c.reply_count,
  c.read_at,
  c.replied_at,
  c.resolved_at,
  c.last_synced_at,
  p.caption as post_caption,
  p.permalink as post_permalink,
  p.published_at as post_published_at,
  a.username as account_username,
  case
    when last_reply.id is null then null
    else jsonb_build_object(
      'id', last_reply.id,
      'message', last_reply.message,
      'platform_reply_id', last_reply.platform_reply_id,
      'sent_at', last_reply.sent_at,
      'created_by', last_reply.created_by
    )
  end as latest_reply
from public.social_comments c
join public.social_posts p on p.id = c.post_id
join public.social_accounts a on a.id = c.account_id
left join lateral (
  select r.id, r.message, r.platform_reply_id, r.sent_at, r.created_by
  from public.social_replies r
  where r.comment_id = c.id
    and r.status = 'sent'
  order by r.sent_at desc nulls last, r.created_at desc
  limit 1
) last_reply on true
where c.is_owned_reply = false;

grant select on public.social_inbox to authenticated;

create or replace function public.social_inbox_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*)::integer,
    'need_reply', count(*) filter (where status in ('new', 'read'))::integer,
    'instagram', count(*) filter (
      where platform = 'instagram' and status in ('new', 'read')
    )::integer,
    'threads', count(*) filter (
      where platform = 'threads' and status in ('new', 'read')
    )::integer,
    'tiktok', count(*) filter (
      where platform = 'tiktok' and status in ('new', 'read')
    )::integer
  )
  from public.social_comments
  where is_owned_reply = false;
$$;

revoke all on function public.social_inbox_summary() from public;
grant execute on function public.social_inbox_summary() to authenticated, service_role;

create or replace function public.upsert_social_inbox_comment(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  incoming_has_owner_reply boolean := coalesce(
    (p_payload ->> 'has_owner_reply')::boolean,
    false
  );
begin
  insert into public.social_comments (
    account_id,
    post_id,
    platform,
    platform_post_id,
    platform_comment_id,
    platform_parent_id,
    author_platform_id,
    author_username,
    author_name,
    message,
    commented_at,
    status,
    is_owned_reply,
    can_reply,
    reply_count,
    replied_at,
    last_synced_at
  )
  values (
    (p_payload ->> 'account_id')::uuid,
    (p_payload ->> 'post_id')::uuid,
    (p_payload ->> 'platform')::public.social_platform,
    p_payload ->> 'platform_post_id',
    p_payload ->> 'platform_comment_id',
    nullif(p_payload ->> 'platform_parent_id', ''),
    nullif(p_payload ->> 'author_platform_id', ''),
    nullif(p_payload ->> 'author_username', ''),
    nullif(p_payload ->> 'author_name', ''),
    coalesce(p_payload ->> 'message', ''),
    (p_payload ->> 'commented_at')::timestamptz,
    case
      when incoming_has_owner_reply then 'replied'::public.social_comment_status
      else 'new'::public.social_comment_status
    end,
    coalesce((p_payload ->> 'is_owned_reply')::boolean, false),
    coalesce((p_payload ->> 'can_reply')::boolean, true),
    greatest(coalesce((p_payload ->> 'reply_count')::integer, 0), 0),
    case when incoming_has_owner_reply then now() else null end,
    now()
  )
  on conflict (platform, platform_comment_id)
  do update set
    account_id = excluded.account_id,
    post_id = excluded.post_id,
    platform_post_id = excluded.platform_post_id,
    platform_parent_id = excluded.platform_parent_id,
    author_platform_id = excluded.author_platform_id,
    author_username = excluded.author_username,
    author_name = excluded.author_name,
    message = excluded.message,
    commented_at = excluded.commented_at,
    is_owned_reply = excluded.is_owned_reply,
    can_reply = excluded.can_reply,
    reply_count = excluded.reply_count,
    status = case
      when public.social_comments.status in ('resolved', 'spam')
        then public.social_comments.status
      when incoming_has_owner_reply
        then 'replied'::public.social_comment_status
      else public.social_comments.status
    end,
    replied_at = case
      when incoming_has_owner_reply
        then coalesce(public.social_comments.replied_at, now())
      else public.social_comments.replied_at
    end,
    last_synced_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.upsert_social_inbox_comment(jsonb) from public;
grant execute on function public.upsert_social_inbox_comment(jsonb) to service_role;

comment on table public.social_accounts is
  'Non-secret social account metadata. Access tokens belong only in Cloudflare Worker secrets.';

comment on table public.social_replies is
  'Idempotent outgoing reply log. pending rows prevent accidental duplicate platform replies.';

commit;
