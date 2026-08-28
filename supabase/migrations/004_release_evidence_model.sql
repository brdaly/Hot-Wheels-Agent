-- One release identity, one collection key, and finite analysis retention.
alter table evaluations
  alter column model_version set default 'collection-priority-v3.0';

alter table releases add column if not exists tooling text;
alter table releases add column if not exists region text;
alter table releases add column if not exists release_fingerprint text;
alter table releases add column if not exists release_fingerprint_aliases text[] not null default '{}';

create or replace function release_fingerprint_token(value text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g')), ''), 'unknown');
$$;

create or replace function maintain_release_fingerprint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  casting_name text;
  prefix text;
  aliases text[] := '{}';
begin
  select name into casting_name from castings where id = new.casting_id;
  -- Legacy releases predate tooling/region capture. The owner-only v0.4 app was
  -- Hot Wheels/US scoped, and tooling used the casting name when not distinct.
  new.tooling := coalesce(new.tooling, casting_name);
  new.region := coalesce(new.region, 'US');
  prefix := concat_ws('|',
    'release-fingerprint-v2',
    'brand:' || release_fingerprint_token('Hot Wheels'),
    'releaseYear:' || release_fingerprint_token(new.release_year::text),
    'casting:' || release_fingerprint_token(casting_name),
    'tooling:' || release_fingerprint_token(new.tooling),
    'line:' || release_fingerprint_token(new.line),
    'seriesOrMix:' || release_fingerprint_token(new.series_mix),
    'colorOrLivery:' || release_fingerprint_token(new.color_livery),
    'chaseStatus:' || release_fingerprint_token(new.chase_status),
    'wheelType:' || release_fingerprint_token(new.wheel_type),
    'cardType:' || release_fingerprint_token(new.card_type),
    'region:' || release_fingerprint_token(new.region)
  );
  if nullif(trim(new.product_code), '') is not null then
    aliases := array_append(aliases, prefix || '|identifier:productCode:' || release_fingerprint_token(new.product_code));
  end if;
  if nullif(trim(new.collector_number), '') is not null then
    aliases := array_append(aliases, prefix || '|identifier:collectorNumber:' || release_fingerprint_token(new.collector_number));
  end if;
  new.release_fingerprint_aliases := aliases;
  new.release_fingerprint := coalesce(aliases[1], prefix || '|identifier:unknown');
  return new;
end;
$$;

drop trigger if exists releases_maintain_fingerprint on releases;
create trigger releases_maintain_fingerprint
before insert or update of casting_id, release_year, line, series_mix, collector_number,
  color_livery, wheel_type, chase_status, card_type, product_code, tooling, region
on releases for each row execute function maintain_release_fingerprint();

-- Populate every pre-v0.5 release before duplicate lookup is enabled.
update releases set tooling = tooling;
create unique index if not exists releases_exact_fingerprint_idx
  on releases(release_fingerprint)
  where release_fingerprint is not null;

alter table photo_evaluations add column if not exists expires_at timestamptz;
update photo_evaluations
  set expires_at = created_at + interval '30 days'
  where expires_at is null;
alter table photo_evaluations alter column expires_at set default (now() + interval '30 days');
create index if not exists photo_evaluations_expiry_idx on photo_evaluations(expires_at);

alter table market_evidence add column if not exists match_quality text not null default 'unknown'
  check (match_quality in ('exact', 'near', 'unknown'));
alter table market_evidence add column if not exists packaging text;
alter table market_evidence add column if not exists condition text;
create index if not exists market_evidence_exact_recent_idx
  on market_evidence(release_id, transaction_date desc)
  where evidence_type = 'completed_sale' and match_quality = 'exact';

alter table sources add column if not exists retrieved_at timestamptz;
alter table sources add column if not exists effective_at timestamptz;
alter table sources add column if not exists expires_at timestamptz;
alter table sources add column if not exists authority text not null default 'secondary';
alter table sources add column if not exists verification_status text not null default 'provisional';
alter table sources add column if not exists content_hash text;

create or replace function purge_expired_photo_evaluations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare removed integer;
begin
  delete from photo_evaluations evaluation
  where evaluation.expires_at < now()
    and not exists (
      select 1 from collection_items item where item.evaluation_id = evaluation.id
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function purge_expired_photo_evaluations() from public, anon, authenticated;

-- RLS is deliberately reasserted here so a partially applied older deployment
-- cannot leave owner data public.
alter table sources enable row level security;
alter table castings enable row level security;
alter table releases enable row level security;
alter table evaluations enable row level security;
alter table collection_items enable row level security;
alter table market_evidence enable row level security;
alter table insights enable row level security;
alter table photo_evaluations enable row level security;
alter table retail_price_snapshots enable row level security;
alter table target_snapshots enable row level security;
alter table audit_events enable row level security;
