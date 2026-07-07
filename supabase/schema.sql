-- Leon fitness — database schema.
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste all of
-- this → Run. Safe to re-run (uses "if not exists" / "or replace").

-- ---------------------------------------------------------------------------
-- 1) PROFILES — one row per user: bodyweight, sex, unit, and data-sharing consent.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  bodyweight numeric,
  unit text not null default 'kg',
  share_data boolean not null default false,
  -- Set by the coach in the dashboard to mark who's a client.
  coaching_status text not null default 'none' check (coaching_status in ('none', 'lead', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the profiles table already exists from an earlier run, add the column:
alter table public.profiles add column if not exists coaching_status text not null default 'none';

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2) SESSIONS — each user's workout log. Exercises/sets stored as JSON so the
--    shape matches the app; protected so users only see their own.
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  name text,
  unit text not null default 'kg',
  exercises jsonb not null default '[]'::jsonb,
  -- How long the session took, in milliseconds (nullable; older rows and
  -- sessions where it couldn't be measured are null). Powers the dashboard's
  -- training-time stats.
  duration_ms bigint,
  created_at timestamptz not null default now()
);

-- If the sessions table already exists from an earlier run, add the column:
alter table public.sessions add column if not exists duration_ms bigint;

alter table public.sessions enable row level security;

create policy "Users can view their own sessions"
  on public.sessions for select using (auth.uid() = user_id);
create policy "Users can insert their own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);
create policy "Users can update their own sessions"
  on public.sessions for update using (auth.uid() = user_id);
create policy "Users can delete their own sessions"
  on public.sessions for delete using (auth.uid() = user_id);

create index if not exists sessions_user_date_idx on public.sessions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- 2b) BODYWEIGHT_LOG — each user's bodyweight over time (one row per weigh-in).
--     Separate from profiles.bodyweight (the single "current" value); this is
--     the time series behind the dashboard's bodyweight chart.
-- ---------------------------------------------------------------------------
create table if not exists public.bodyweight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  weight numeric not null,
  unit text not null default 'kg',
  created_at timestamptz not null default now()
);

alter table public.bodyweight_log enable row level security;

create policy "Users can view their own bodyweight"
  on public.bodyweight_log for select using (auth.uid() = user_id);
create policy "Users can insert their own bodyweight"
  on public.bodyweight_log for insert with check (auth.uid() = user_id);
create policy "Users can update their own bodyweight"
  on public.bodyweight_log for update using (auth.uid() = user_id);
create policy "Users can delete their own bodyweight"
  on public.bodyweight_log for delete using (auth.uid() = user_id);

create index if not exists bodyweight_user_date_idx on public.bodyweight_log (user_id, date desc);

-- ---------------------------------------------------------------------------
-- 3) SHARED_LIFTS — anonymized data for analysis. NO user identity is stored.
--    Signed-in users may contribute (insert), but the app can't read it back
--    (no select policy) — only the Supabase dashboard can, for your analysis.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_lifts (
  id uuid primary key default gen_random_uuid(),
  exercise text not null,
  weight numeric,
  reps int,
  rir int,
  unit text,
  bodyweight numeric,
  sex text,
  logged_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shared_lifts enable row level security;

create policy "Authenticated users can contribute anonymized lifts"
  on public.shared_lifts for insert
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- 4) SUBMISSION_LOG — rate-limiting for guest contributions (via the
--    contribute-lifts edge function). No policies: only the service role
--    (the function) can touch it.
-- ---------------------------------------------------------------------------
create table if not exists public.submission_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.submission_log enable row level security;

create index if not exists submission_log_ip_time_idx on public.submission_log (ip_hash, created_at desc);
