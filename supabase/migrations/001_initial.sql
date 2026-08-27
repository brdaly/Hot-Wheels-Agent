create extension if not exists pgcrypto;

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  source_tier smallint not null check (source_tier between 1 and 4),
  approved_use text not null,
  last_checked_at timestamptz
);

create table castings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  debut_year smallint,
  designer text,
  manufacturer_lane text,
  casting_score smallint check (casting_score between 0 and 100),
  source_id uuid references sources(id),
  unique (name, debut_year)
);

create table releases (
  id uuid primary key default gen_random_uuid(),
  casting_id uuid not null references castings(id),
  release_year smallint,
  line text,
  series_mix text,
  collector_number text,
  color_livery text,
  wheel_type text,
  chase_status text not null default 'none',
  card_type text,
  product_code text,
  identity_confidence text not null default 'low',
  verification_status text not null default 'needs_verification',
  unique nulls not distinct (casting_id, release_year, line, series_mix, product_code, color_livery)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references releases(id),
  identity_snapshot jsonb not null,
  score_components jsonb not null,
  collection_priority_score smallint not null check (collection_priority_score between 0 and 100),
  tier text not null,
  market_evidence_grade text not null default 'U',
  evidence_observed jsonb not null default '[]',
  verification_needed jsonb not null default '[]',
  status text not null default 'needs_verification',
  model_version text not null default 'collection-priority-v1.0',
  created_at timestamptz not null default now()
);

create table collection_items (
  id uuid primary key default gen_random_uuid(),
  release_id uuid references releases(id),
  quantity integer not null default 1 check (quantity > 0),
  ownership_status text not null check (ownership_status in ('observed','candidate','owned','sold','traded')),
  package_condition text,
  purchase_price numeric(10,2),
  purchase_date date,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table market_evidence (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references releases(id),
  source_id uuid references sources(id),
  evidence_type text not null,
  observed_price numeric(10,2),
  currency char(3) default 'USD',
  transaction_date date,
  url text,
  captured_at timestamptz not null default now()
);

create table insights (
  id uuid primary key default gen_random_uuid(),
  insight_type text not null,
  statement text not null,
  evidence jsonb not null default '[]',
  confidence text not null default 'medium',
  supersedes uuid references insights(id),
  created_at timestamptz not null default now()
);

create index releases_casting_year_idx on releases(casting_id, release_year desc);
create index evaluations_score_idx on evaluations(collection_priority_score desc, created_at desc);
create index collection_owned_idx on collection_items(ownership_status) where ownership_status = 'owned';
