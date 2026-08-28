begin;

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.app_members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  role text not null check (role = 'owner'),
  created_at timestamptz not null default now()
);
alter table private.app_members enable row level security;
revoke all on table private.app_members from public, anon, authenticated;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.app_members member
    where member.user_id = (select auth.uid())
      and member.role = 'owner'
  );
$$;
revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_owner() to authenticated, service_role;

alter table public.collection_items
  add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.photo_evaluations
  add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table public.photo_evaluations
  add column if not exists expires_at timestamptz;
update public.photo_evaluations
set expires_at = created_at + interval '30 days'
where expires_at is null;
alter table public.photo_evaluations
  alter column expires_at set default (now() + interval '30 days');

create index if not exists collection_items_owner_created_idx
  on public.collection_items(owner_id, created_at desc);
create index if not exists photo_evaluations_owner_created_idx
  on public.photo_evaluations(owner_id, created_at desc);
create index if not exists photo_evaluations_expiry_idx
  on public.photo_evaluations(expires_at)
  where expires_at is not null;

create table if not exists public.model_usage_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  trace_id uuid not null,
  provider_request_id text,
  model text not null check (char_length(model) between 1 and 120),
  status text not null check (status in ('completed', 'incomplete', 'failed')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  usage_details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);
create unique index if not exists model_usage_trace_idx on public.model_usage_events(trace_id);
create index if not exists model_usage_owner_created_idx
  on public.model_usage_events(owner_id, created_at desc);
create index if not exists model_usage_expiry_idx on public.model_usage_events(expires_at);
alter table public.model_usage_events enable row level security;
revoke all on table public.model_usage_events from anon, authenticated;
grant select on table public.model_usage_events to authenticated;

create table if not exists private.rate_limit_buckets (
  scope text not null check (char_length(scope) between 1 and 80),
  key_hash text not null check (char_length(key_hash) between 32 and 128),
  tokens numeric not null check (tokens >= 0),
  updated_at timestamptz not null,
  primary key (scope, key_hash)
);
alter table private.rate_limit_buckets enable row level security;
revoke all on table private.rate_limit_buckets from public, anon, authenticated;
create index if not exists rate_limit_buckets_updated_idx on private.rate_limit_buckets(updated_at);

create or replace function public.consume_rate_limit(
  p_scope text,
  p_key_hash text,
  p_capacity integer,
  p_refill_per_second numeric,
  p_cost integer default 1
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_tokens numeric;
  v_updated_at timestamptz;
  v_available numeric;
begin
  if p_scope is null
    or p_key_hash is null
    or p_capacity is null
    or p_refill_per_second is null
    or p_cost is null
    or p_scope !~ '^[A-Za-z0-9:_-]{1,80}$'
    or char_length(p_key_hash) not between 32 and 128
    or p_capacity not between 1 and 100000
    or p_refill_per_second <= 0
    or p_refill_per_second > 1000
    or p_cost not between 1 and p_capacity then
    raise exception 'invalid_rate_limit_policy' using errcode = '22023';
  end if;

  insert into private.rate_limit_buckets(scope, key_hash, tokens, updated_at)
  values (p_scope, p_key_hash, p_capacity, v_now)
  on conflict (scope, key_hash) do nothing;

  select bucket.tokens, bucket.updated_at
  into v_tokens, v_updated_at
  from private.rate_limit_buckets bucket
  where bucket.scope = p_scope and bucket.key_hash = p_key_hash
  for update;

  v_available := least(
    p_capacity::numeric,
    v_tokens + greatest(0::numeric, extract(epoch from (v_now - v_updated_at))::numeric) * p_refill_per_second
  );

  if v_available >= p_cost then
    v_available := v_available - p_cost;
    update private.rate_limit_buckets bucket
    set tokens = v_available, updated_at = v_now
    where bucket.scope = p_scope and bucket.key_hash = p_key_hash;
    return query select true, floor(v_available)::integer, 0;
  else
    update private.rate_limit_buckets bucket
    set tokens = v_available, updated_at = v_now
    where bucket.scope = p_scope and bucket.key_hash = p_key_hash;
    return query select
      false,
      floor(v_available)::integer,
      greatest(1, ceil((p_cost - v_available) / p_refill_per_second)::integer);
  end if;
end;
$$;
revoke all on function public.consume_rate_limit(text, text, integer, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, numeric, integer)
  to service_role;

drop policy if exists owner_collection_select on public.collection_items;
drop policy if exists owner_collection_insert on public.collection_items;
drop policy if exists owner_collection_update on public.collection_items;
drop policy if exists owner_collection_delete on public.collection_items;
revoke all on table public.collection_items from anon, authenticated;
grant select, insert, update, delete on table public.collection_items to authenticated;
create policy owner_collection_select on public.collection_items
  for select to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));
create policy owner_collection_insert on public.collection_items
  for insert to authenticated
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));
create policy owner_collection_update on public.collection_items
  for update to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()))
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));
create policy owner_collection_delete on public.collection_items
  for delete to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists owner_photo_evaluations_select on public.photo_evaluations;
drop policy if exists owner_photo_evaluations_insert on public.photo_evaluations;
revoke all on table public.photo_evaluations from anon, authenticated;
grant select, insert on table public.photo_evaluations to authenticated;
create policy owner_photo_evaluations_select on public.photo_evaluations
  for select to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));
create policy owner_photo_evaluations_insert on public.photo_evaluations
  for insert to authenticated
  with check ((select private.is_owner()) and owner_id = (select auth.uid()));

drop policy if exists owner_model_usage_select on public.model_usage_events;
create policy owner_model_usage_select on public.model_usage_events
  for select to authenticated
  using ((select private.is_owner()) and owner_id = (select auth.uid()));

revoke all on table public.castings, public.releases from anon, authenticated;
grant select on table public.castings, public.releases to authenticated;
drop policy if exists owner_castings_select on public.castings;
drop policy if exists owner_releases_select on public.releases;
create policy owner_castings_select on public.castings
  for select to authenticated using ((select private.is_owner()));
create policy owner_releases_select on public.releases
  for select to authenticated using ((select private.is_owner()));

drop policy if exists owner_audit_select on public.audit_events;
revoke all on table public.audit_events from anon, authenticated;
grant select on table public.audit_events to authenticated;
create policy owner_audit_select on public.audit_events
  for select to authenticated using ((select private.is_owner()));

create or replace function private.purge_expired_trust_safety_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.model_usage_events where expires_at <= now();
  delete from public.photo_evaluations evaluation
  where evaluation.expires_at <= now()
    and not exists (
      select 1 from public.collection_items item where item.evaluation_id = evaluation.id
    );
  delete from private.rate_limit_buckets where updated_at < now() - interval '7 days';
end;
$$;
revoke all on function private.purge_expired_trust_safety_data()
  from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'hot_wheels_trust_safety_retention';
    perform cron.schedule(
      'hot_wheels_trust_safety_retention',
      '17 4 * * *',
      'select private.purge_expired_trust_safety_data()'
    );
  end if;
end;
$$;

commit;
