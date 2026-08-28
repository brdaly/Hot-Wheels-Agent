-- One release identity, one collection key, and finite analysis retention.
alter table evaluations
  alter column model_version set default 'collection-priority-v3.0';

alter table releases add column if not exists tooling text;
alter table releases add column if not exists region text;
alter table releases add column if not exists release_fingerprint text;
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
