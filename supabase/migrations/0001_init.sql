-- =====================================================================
-- Sahulat Service Orchestrator — Initial schema
-- Postgres 15 / Supabase. RLS enabled where appropriate.
-- =====================================================================

-- pgcrypto provides gen_random_uuid(); Supabase enables it by default.
create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type service_type as enum (
    'ac_repair','plumbing','electrical','appliance_repair','cleaning',
    'tutoring','beauty','driver','mechanic','carpentry','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type complexity as enum ('basic','intermediate','complex');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_level as enum ('low','medium','high','emergency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum (
    'pending','confirmed','en_route','in_progress',
    'completed','cancelled_by_user','cancelled_by_provider','no_show','disputed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum ('open','under_review','resolved','escalated');
exception when duplicate_object then null; end $$;

do $$ begin
  create type loyalty_tier as enum ('new','regular','loyal');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                       -- supabase auth.users.id (nullable for anon demo)
  display_name text not null,
  phone text,
  preferred_language text not null default 'mixed',  -- 'ur' | 'ur-Latn' | 'en' | 'mixed'
  home_lat double precision,
  home_lng double precision,
  loyalty_tier loyalty_tier not null default 'new',
  prefs jsonb not null default '{}'::jsonb,        -- {female_only:bool, english_speaking:bool, ...}
  created_at timestamptz not null default now()
);

-- ---------- providers ----------
create table if not exists providers (
  id uuid primary key default gen_random_uuid(),
  external_place_id text unique,                   -- google places id when sourced live
  name text not null,
  phone text,
  primary_service service_type not null,
  skills text[] not null default '{}',             -- granular skills, e.g. {'split_ac_service','window_ac_install'}
  specialization_level complexity not null default 'intermediate',
  certifications text[] not null default '{}',     -- {'pec_certified','split_ac_certified'}
  city text not null,
  area text,
  lat double precision not null,
  lng double precision not null,
  rating_avg numeric(3,2) not null default 4.40,   -- bayesian-corrected at read time
  rating_count int not null default 0,
  recent_negative_review_count int not null default 0,
  on_time_score numeric(3,2) not null default 0.85,  -- 0..1
  cancel_rate numeric(3,2) not null default 0.04,    -- 0..1
  hourly_rate int not null default 800,              -- PKR
  visit_fee int not null default 300,                -- PKR
  daily_capacity int not null default 6,
  jobs_today int not null default 0,
  blacklisted boolean not null default false,
  risk_score numeric(3,2) not null default 0.05,
  gender text,                                       -- 'male' | 'female' | null
  languages text[] not null default '{ur-Latn,en}',
  bio text,
  created_at timestamptz not null default now()
);
create index if not exists providers_service_city_idx on providers(primary_service, city);
create index if not exists providers_geo_idx on providers(lat, lng);

-- ---------- provider availability windows ----------
create table if not exists provider_availability (
  provider_id uuid not null references providers(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_minute int not null check (start_minute between 0 and 1440),
  end_minute   int not null check (end_minute   between 0 and 1440),
  primary key (provider_id, day_of_week, start_minute)
);

-- ---------- bookings ----------
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  provider_id uuid references providers(id) on delete set null,
  service service_type not null,
  complexity_hint complexity not null default 'intermediate',
  urgency urgency_level not null default 'medium',
  request_text text not null,
  parsed_intent jsonb not null,                      -- full intent payload
  location_raw text,
  location_lat double precision,
  location_lng double precision,
  scheduled_start timestamptz,
  scheduled_end   timestamptz,
  status booking_status not null default 'pending',
  price_breakdown jsonb,                             -- line items + total
  total_price int,                                   -- PKR (cached)
  actual_start timestamptz,
  actual_end timestamptz,
  on_time_delta_min int,                             -- + late, − early
  completion_checklist jsonb,
  proof_photo_urls text[] not null default '{}',
  rating int,
  rating_comment text,
  sentiment_score numeric(3,2),                      -- −1..1
  sentiment_themes text[] not null default '{}',
  notification_log jsonb not null default '[]'::jsonb,
  cancellation_reason text,
  cancelled_by text,                                  -- 'user' | 'provider' | 'system'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_provider_idx on bookings(provider_id, scheduled_start);
create index if not exists bookings_status_idx on bookings(status);

-- ---------- waitlist ----------
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  service service_type not null,
  area text,
  requested_after timestamptz not null,
  requested_before timestamptz not null,
  parsed_intent jsonb not null,
  status text not null default 'waiting',     -- waiting | matched | expired
  created_at timestamptz not null default now()
);

-- ---------- reviews (separate table for richer ranking) ----------
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  sentiment_score numeric(3,2),
  themes text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists reviews_provider_idx on reviews(provider_id, created_at desc);

-- ---------- disputes ----------
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  raised_by text not null check (raised_by in ('user','provider')),
  case_type text not null,                       -- enumerated in app layer
  evidence_urls text[] not null default '{}',
  description text,
  decision text,
  refund_amount int,
  reputation_delta jsonb,
  status dispute_status not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- traces (Antigravity-style agent reasoning artifacts) ----------
create table if not exists traces (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  request_id uuid not null,                         -- groups events from a single user request
  agent text not null,                              -- 'intent' | 'matcher' | 'pricer' | 'scheduler' | 'orchestrator' | ...
  step text not null,
  input_summary text,
  output jsonb,
  rationale text,
  confidence numeric(3,2),
  model text,
  latency_ms int,
  created_at timestamptz not null default now()
);
create index if not exists traces_request_idx on traces(request_id, created_at);
create index if not exists traces_booking_idx on traces(booking_id, created_at);

-- ---------- updated_at trigger ----------
create or replace function bump_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at before update on bookings
  for each row execute function bump_updated_at();

-- ---------- helper: nearby providers ----------
create or replace function nearby_providers(
  p_service service_type, p_lat double precision, p_lng double precision,
  p_radius_km double precision default 15.0, p_limit int default 25
) returns setof providers
language sql stable as $$
  select * from providers
  where primary_service = p_service
    and blacklisted = false
    and 6371.0 * 2 * asin(sqrt(
          pow(sin(radians(lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(lat)) *
          pow(sin(radians(lng - p_lng) / 2), 2)
        )) <= p_radius_km
  order by 6371.0 * 2 * asin(sqrt(
          pow(sin(radians(lat - p_lat) / 2), 2) +
          cos(radians(p_lat)) * cos(radians(lat)) *
          pow(sin(radians(lng - p_lng) / 2), 2)
        )) asc
  limit p_limit;
$$;

-- ---------- RLS ----------
alter table profiles  enable row level security;
alter table bookings  enable row level security;
alter table reviews   enable row level security;
alter table disputes  enable row level security;
alter table traces    enable row level security;
alter table waitlist  enable row level security;

-- Demo policies: server-only writes via service role; reads allowed for owner.
do $$ begin
  create policy "self profile read" on profiles for select
    using (auth.uid() is null or auth_user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own bookings read" on bookings for select
    using (auth.uid() is null or profile_id in (select id from profiles where auth_user_id = auth.uid()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own traces read" on traces for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "providers public read" on providers for select using (true);
exception when duplicate_object then null; end $$;
alter table providers disable row level security; -- public read OK; writes via service role only

-- ---------- storage bucket placeholder ----------
-- Run separately in Supabase dashboard:
-- insert into storage.buckets (id, name, public) values ('proofs','proofs', true) on conflict do nothing;
