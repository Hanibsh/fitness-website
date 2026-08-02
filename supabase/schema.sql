-- Leon fitness — database schema.
-- Run this in Supabase: Dashboard → SQL Editor → New query → paste all of this
-- → Run. Safe to re-run, and re-running it is the intended way to apply a
-- change: paste the WHOLE file rather than hand-picking the new lines.
--
-- Every statement here is idempotent, which takes a bit of care:
--   * tables/indexes  → "if not exists"
--   * functions       → "or replace"
--   * triggers        → "drop ... if exists" first
--   * POLICIES        → "drop policy if exists" first. Postgres has no
--     "create policy if not exists", so without the drop, a second run dies on
--     the first policy with 42710 "policy already exists" — and because the
--     policies sit ABOVE most of the "alter table add column" lines, everything
--     below them silently never runs. That's not hypothetical: it's how
--     sessions.duration_ms went missing from production for weeks while the
--     app dutifully kept sending it (found 2026-08-03).

-- ---------------------------------------------------------------------------
-- 1) PROFILES — one row per user: bodyweight, sex, unit, and data-sharing consent.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  sex text check (sex in ('male', 'female')),
  bodyweight numeric,
  -- Height is stored in the user's `unit` system (cm when kg, inches when lbs),
  -- same as bodyweight.
  height numeric,
  birth_year int,
  unit text not null default 'kg',
  -- Training profile — feeds the (future) workout generator and prefills the
  -- calculators. All optional; the app validates the values on save too.
  goal text check (goal in ('lose_fat', 'gain_muscle', 'recomp', 'maintain')),
  experience_level text check (experience_level in ('beginner', 'intermediate', 'advanced')),
  -- RETIRED 2026-07-17: no longer collected or read (experience_level already
  -- states its year range, and the real schedule is observable from logged
  -- sessions). Kept, not dropped, so existing rows aren't destroyed — dropping a
  -- column is irreversible and buys nothing here.
  training_months int,
  days_per_week int,
  session_minutes int,
  equipment text check (equipment in ('gym', 'home', 'dumbbells', 'bodyweight')),
  share_data boolean not null default false,
  -- Set by the coach in the dashboard to mark who's a client.
  coaching_status text not null default 'none' check (coaching_status in ('none', 'lead', 'client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the profiles table already exists from an earlier run, add the columns:
alter table public.profiles add column if not exists coaching_status text not null default 'none';
alter table public.profiles add column if not exists height numeric;
alter table public.profiles add column if not exists birth_year int;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists experience_level text;
alter table public.profiles add column if not exists training_months int;
alter table public.profiles add column if not exists days_per_week int;
alter table public.profiles add column if not exists session_minutes int;
alter table public.profiles add column if not exists equipment text;

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
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
  -- When training actually ran, from the first logged set to the last. Unlike
  -- `date` above (which is noon-pinned so day bucketing can't drift across
  -- timezones) these carry a real time of day, and are editable by the user.
  -- Nullable: older rows, and sessions whose window wasn't plausible.
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- If the sessions table already exists from an earlier run, add the columns:
alter table public.sessions add column if not exists duration_ms bigint;
alter table public.sessions add column if not exists started_at timestamptz;
alter table public.sessions add column if not exists ended_at timestamptz;

alter table public.sessions enable row level security;

drop policy if exists "Users can view their own sessions" on public.sessions;
create policy "Users can view their own sessions"
  on public.sessions for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own sessions" on public.sessions;
create policy "Users can insert their own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own sessions" on public.sessions;
create policy "Users can update their own sessions"
  on public.sessions for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own sessions" on public.sessions;
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

drop policy if exists "Users can view their own bodyweight" on public.bodyweight_log;
create policy "Users can view their own bodyweight"
  on public.bodyweight_log for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own bodyweight" on public.bodyweight_log;
create policy "Users can insert their own bodyweight"
  on public.bodyweight_log for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own bodyweight" on public.bodyweight_log;
create policy "Users can update their own bodyweight"
  on public.bodyweight_log for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own bodyweight" on public.bodyweight_log;
create policy "Users can delete their own bodyweight"
  on public.bodyweight_log for delete using (auth.uid() = user_id);

create index if not exists bodyweight_user_date_idx on public.bodyweight_log (user_id, date desc);

-- ---------------------------------------------------------------------------
-- 2c) PROGRAMS — each user's active training program (the rotating routine).
--     One row per user; the whole program (days, planned exercises, pointer)
--     is a single JSON blob so the shape matches the app. Upsert by user_id.
-- ---------------------------------------------------------------------------
create table if not exists public.programs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.programs enable row level security;

drop policy if exists "Users can view their own program" on public.programs;
create policy "Users can view their own program"
  on public.programs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own program" on public.programs;
create policy "Users can insert their own program"
  on public.programs for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own program" on public.programs;
create policy "Users can update their own program"
  on public.programs for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own program" on public.programs;
create policy "Users can delete their own program"
  on public.programs for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2d) BLOCKS — each user's specialization blocks (muscle-group focus phases).
--     One row per user; the whole list is a single JSON array. Upsert by user_id.
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.blocks enable row level security;

drop policy if exists "Users can view their own blocks" on public.blocks;
create policy "Users can view their own blocks"
  on public.blocks for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own blocks" on public.blocks;
create policy "Users can insert their own blocks"
  on public.blocks for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own blocks" on public.blocks;
create policy "Users can update their own blocks"
  on public.blocks for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own blocks" on public.blocks;
create policy "Users can delete their own blocks"
  on public.blocks for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2e) DAY_ANNOTATIONS — non-workout day markers: sick, injured, traveling,
--     resting, or another reason, each with an optional note. Independent of
--     sessions — a day can have both a logged workout and an annotation (you
--     trained through it). One row per annotated day.
-- ---------------------------------------------------------------------------
create table if not exists public.day_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.day_annotations enable row level security;

drop policy if exists "Users can view their own day annotations" on public.day_annotations;
create policy "Users can view their own day annotations"
  on public.day_annotations for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own day annotations" on public.day_annotations;
create policy "Users can insert their own day annotations"
  on public.day_annotations for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own day annotations" on public.day_annotations;
create policy "Users can update their own day annotations"
  on public.day_annotations for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own day annotations" on public.day_annotations;
create policy "Users can delete their own day annotations"
  on public.day_annotations for delete using (auth.uid() = user_id);

create index if not exists day_annotations_user_date_idx on public.day_annotations (user_id, date desc);

-- ---------------------------------------------------------------------------
-- 2f) EXERCISE_NOTES — each user's per-movement notes (form cues, machine
--     settings), keyed by exercise id/name. One row per user; the whole map is
--     a single JSON object, same pattern as PROGRAMS/BLOCKS. Upsert by user_id.
-- ---------------------------------------------------------------------------
create table if not exists public.exercise_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.exercise_notes enable row level security;

drop policy if exists "Users can view their own exercise notes" on public.exercise_notes;
create policy "Users can view their own exercise notes"
  on public.exercise_notes for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own exercise notes" on public.exercise_notes;
create policy "Users can insert their own exercise notes"
  on public.exercise_notes for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own exercise notes" on public.exercise_notes;
create policy "Users can update their own exercise notes"
  on public.exercise_notes for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own exercise notes" on public.exercise_notes;
create policy "Users can delete their own exercise notes"
  on public.exercise_notes for delete using (auth.uid() = user_id);

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

drop policy if exists "Authenticated users can contribute anonymized lifts" on public.shared_lifts;
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
