begin;

create table if not exists private.analysis_leases (
  id uuid primary key default gen_random_uuid(),
  subject_hash text not null check (char_length(subject_hash) between 32 and 128),
  expires_at timestamptz not null
);
alter table private.analysis_leases enable row level security;
revoke all on table private.analysis_leases from public, anon, authenticated;
create index if not exists analysis_leases_subject_expiry_idx
  on private.analysis_leases(subject_hash, expires_at);

create or replace function public.acquire_analysis_lease(
  p_subject_hash text,
  p_maximum integer default 2,
  p_ttl_seconds integer default 120
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_active integer;
begin
  if char_length(p_subject_hash) not between 32 and 128
    or p_maximum not between 1 and 10
    or p_ttl_seconds not between 15 and 300 then
    raise exception 'invalid_analysis_lease_policy' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_hash, 0));
  delete from private.analysis_leases where expires_at <= clock_timestamp();
  select count(*) into v_active
    from private.analysis_leases
    where subject_hash = p_subject_hash and expires_at > clock_timestamp();
  if v_active >= p_maximum then return null; end if;
  insert into private.analysis_leases(subject_hash, expires_at)
    values (p_subject_hash, clock_timestamp() + make_interval(secs => p_ttl_seconds))
    returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.release_analysis_lease(p_lease_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from private.analysis_leases where id = p_lease_id; $$;

revoke all on function public.acquire_analysis_lease(text, integer, integer) from public, anon, authenticated;
revoke all on function public.release_analysis_lease(uuid) from public, anon, authenticated;
grant execute on function public.acquire_analysis_lease(text, integer, integer) to service_role;
grant execute on function public.release_analysis_lease(uuid) to service_role;

commit;
