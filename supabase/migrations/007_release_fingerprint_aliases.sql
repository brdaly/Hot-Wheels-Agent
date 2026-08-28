begin;

-- This is forward-only because migration 004 may already have run in production.
alter table public.evaluations
  alter column model_version set default 'collection-priority-v3.1';

alter table public.releases
  add column if not exists release_fingerprint_aliases text[] not null default '{}';
alter table public.releases
  add column if not exists release_identity_core text;

create or replace function public.release_fingerprint_token(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    translate(
      normalize(coalesce(value, ''), NFKC) collate "C",
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz'
    ),
    '[^a-z0-9]+', '-', 'g'
  )), ''), 'unknown');
$$;

do $canonical_token_contract$
begin
  if public.release_fingerprint_token('Ｆ４０') <> 'f40'
    or public.release_fingerprint_token(' US ') <> 'us'
    or public.release_fingerprint_token('’87 Buick Regal GNX') <> '87-buick-regal-gnx'
    or public.release_fingerprint_token('Café') <> 'caf'
    or public.release_fingerprint_token('I') <> 'i'
    or public.release_fingerprint_token('   ') <> 'unknown'
  then
    raise exception 'release fingerprint canonical-token contract is unavailable';
  end if;
end;
$canonical_token_contract$;

create or replace function public.maintain_release_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  casting_name text;
  prefix text;
  aliases text[] := '{}';
begin
  select name into casting_name from public.castings where id = new.casting_id;
  new.release_identity_core := null;
  new.release_fingerprint_aliases := '{}';
  new.release_fingerprint := null;
  -- Unknown identity facts stay unknown. Incomplete legacy rows remain
  -- provisional until a human verifies tooling, region, and every exact field.
  if public.release_fingerprint_token(new.release_year::text) = 'unknown'
    or public.release_fingerprint_token(casting_name) = 'unknown'
    or public.release_fingerprint_token(new.tooling) = 'unknown'
    or public.release_fingerprint_token(new.line) = 'unknown'
    or public.release_fingerprint_token(new.series_mix) = 'unknown'
    or public.release_fingerprint_token(new.color_livery) = 'unknown'
    or public.release_fingerprint_token(new.wheel_type) = 'unknown'
    or public.release_fingerprint_token(new.card_type) = 'unknown'
    or public.release_fingerprint_token(new.region) = 'unknown'
    or public.release_fingerprint_token(new.chase_status) = 'unknown'
    or (
      public.release_fingerprint_token(new.product_code) = 'unknown'
      and public.release_fingerprint_token(new.collector_number) = 'unknown'
    )
  then
    return new;
  end if;
  prefix := concat_ws('|',
    'release-fingerprint-v2',
    'brand:' || public.release_fingerprint_token('Hot Wheels'),
    'releaseYear:' || public.release_fingerprint_token(new.release_year::text),
    'casting:' || public.release_fingerprint_token(casting_name),
    'tooling:' || public.release_fingerprint_token(new.tooling),
    'line:' || public.release_fingerprint_token(new.line),
    'seriesOrMix:' || public.release_fingerprint_token(new.series_mix),
    'colorOrLivery:' || public.release_fingerprint_token(new.color_livery),
    'chaseStatus:' || public.release_fingerprint_token(new.chase_status),
    'wheelType:' || public.release_fingerprint_token(new.wheel_type),
    'cardType:' || public.release_fingerprint_token(new.card_type),
    'region:' || public.release_fingerprint_token(new.region)
  );
  new.release_identity_core := prefix;
  if public.release_fingerprint_token(new.product_code) <> 'unknown' then
    aliases := array_append(aliases, prefix || '|identifier:productCode:' || public.release_fingerprint_token(new.product_code));
  end if;
  if public.release_fingerprint_token(new.collector_number) <> 'unknown' then
    aliases := array_append(aliases, prefix || '|identifier:collectorNumber:' || public.release_fingerprint_token(new.collector_number));
  end if;
  new.release_fingerprint_aliases := aliases;
  new.release_fingerprint := aliases[1];
  return new;
end;
$$;

revoke all on function public.maintain_release_fingerprint() from public, anon, authenticated;

drop trigger if exists releases_maintain_fingerprint on public.releases;
create trigger releases_maintain_fingerprint
before insert or update
on public.releases for each row execute function public.maintain_release_fingerprint();

create table if not exists public.release_fingerprint_claims (
  fingerprint text primary key,
  release_id uuid not null references public.releases(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (release_id, fingerprint)
);
alter table public.release_fingerprint_claims enable row level security;
revoke all on table public.release_fingerprint_claims from public, anon, authenticated;
grant select on table public.release_fingerprint_claims to service_role;

create or replace function public.sync_release_fingerprint_claims()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.release_fingerprint_claims where release_id = old.id;
    return old;
  end if;
  delete from public.release_fingerprint_claims where release_id = new.id;
  insert into public.release_fingerprint_claims(fingerprint, release_id)
  select distinct claim.alias, new.id
  from unnest(new.release_fingerprint_aliases) as claim(alias);
  return new;
end;
$$;
revoke all on function public.sync_release_fingerprint_claims() from public, anon, authenticated;

drop trigger if exists releases_sync_fingerprint_claims on public.releases;
create trigger releases_sync_fingerprint_claims
after insert or update or delete on public.releases
for each row execute function public.sync_release_fingerprint_claims();

create or replace function public.prevent_referenced_casting_rename()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
    and exists (select 1 from public.releases where casting_id = old.id)
  then
    raise exception 'Referenced casting names require an explicit identity migration'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_referenced_casting_rename() from public, anon, authenticated;

drop trigger if exists castings_prevent_referenced_rename on public.castings;
create trigger castings_prevent_referenced_rename
before update of name on public.castings
for each row execute function public.prevent_referenced_casting_rename();

-- Populate aliases for every release created before this migration.
update public.releases set tooling = tooling;

create unique index if not exists releases_identity_core_idx
  on public.releases(release_identity_core)
  where release_identity_core is not null;
create index if not exists releases_fingerprint_aliases_gin_idx
  on public.releases using gin(release_fingerprint_aliases);
alter table public.releases
  add constraint releases_fingerprint_state_check check (
    (
      release_identity_core is null
      and release_fingerprint is null
      and cardinality(release_fingerprint_aliases) = 0
    )
    or (
      release_identity_core is not null
      and cardinality(release_fingerprint_aliases) > 0
      and release_fingerprint = release_fingerprint_aliases[1]
    )
  );
create index if not exists collection_items_owned_release_owner_idx
  on public.collection_items(release_id, owner_id)
  where ownership_status = 'owned';

-- Aggregate only the requested aliases in the database. This avoids both a
-- pre-filter row limit and PostgREST's default result cap.
create or replace function public.owned_quantities_by_fingerprints(
  target_fingerprints text[],
  target_owner_id uuid default null
)
returns table(fingerprint text, quantity bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested as (
    select distinct btrim(input.value) as fingerprint
    from unnest(coalesce(target_fingerprints, array[]::text[])) as input(value)
    where nullif(btrim(input.value), '') is not null
  )
  select requested.fingerprint, coalesce(sum(item.quantity), 0)::bigint
  from requested
  left join public.release_fingerprint_claims claim
    on claim.fingerprint = requested.fingerprint
  left join public.collection_items item
    on item.release_id = claim.release_id
    and item.ownership_status = 'owned'
    and (target_owner_id is null or item.owner_id = target_owner_id)
  group by requested.fingerprint
  order by requested.fingerprint;
$$;

revoke all on function public.owned_quantities_by_fingerprints(text[], uuid)
  from public, anon, authenticated;
grant execute on function public.owned_quantities_by_fingerprints(text[], uuid)
  to service_role;

commit;
