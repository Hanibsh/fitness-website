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
  -- Muscles to bring up (up to 3, engine muscle names): the split generator's
  -- focus, so every new split starts from it. Validated by the app
  -- (profileFields.js cleanFocus); unknown names are ignored on read.
  focus_muscles text[],
  -- Calculator inputs, kept here so they're entered once instead of on every
  -- tool (profilePrefill.js hands them out). Wrist and ankle are stored in the
  -- `unit` system like height; body fat is a whole percent. Training start is a
  -- year so "years trained" keeps counting by itself, the way birth_year does.
  body_fat numeric,
  wrist numeric,
  ankle numeric,
  daily_steps int,
  diet text check (diet in ('omnivore', 'vegan')),
  training_start_year int,
  -- Which dashboard cards show and in what order: { order: [ids], hidden: [ids] }
  -- (lib/dashboardLayout.js). Unknown ids are dropped on read.
  dashboard_layout jsonb,
  -- The site theme from Profile → Appearance (an id from lib/theme.js THEMES),
  -- so it follows you between devices. Unknown ids are ignored on read.
  theme text,
  share_data boolean not null default false,
  -- Set by the coach in the dashboard to mark who's a client.
  coaching_status text not null default 'none' check (coaching_status in ('none', 'lead', 'client')),
  -- The coach's own account: shows the client list (/coach). Set by hand in the
  -- SQL editor, never by the app. Setting it on yourself only reveals an empty
  -- client list of your own — the clients table below is per-user under RLS.
  is_coach boolean not null default false,
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
alter table public.profiles add column if not exists focus_muscles text[];
alter table public.profiles add column if not exists body_fat numeric;
alter table public.profiles add column if not exists wrist numeric;
alter table public.profiles add column if not exists ankle numeric;
alter table public.profiles add column if not exists daily_steps int;
alter table public.profiles add column if not exists diet text;
alter table public.profiles add column if not exists training_start_year int;
alter table public.profiles add column if not exists dashboard_layout jsonb;
alter table public.profiles add column if not exists theme text;
alter table public.profiles add column if not exists is_coach boolean not null default false;

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

-- is_coach and coaching_status are set by hand in the SQL editor, never by the
-- app — but the "update their own profile" policy above covers every column,
-- so without this anyone could make themselves a coach and send invites
-- (section 2i). A request from the app always carries a signed-in user
-- (auth.uid() set); the SQL editor and Table Editor don't, so they still can.
create or replace function public.protect_profile_flags()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.is_coach := false;
      new.coaching_status := 'none';
    else
      new.is_coach := old.is_coach;
      new.coaching_status := old.coaching_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_flags on public.profiles;
create trigger protect_profile_flags
  before insert or update on public.profiles
  for each row execute function public.protect_profile_flags();

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
-- 2f) INJURIES — a hurt body part tracked over its whole life, not a day.
--     An injury opens, gets better or worse across weeks, changes what the app
--     recommends the whole time, and then resolves. Deliberately NOT a run of
--     day_annotations rows: marking a day 'injury' SPENDS that day's split slot
--     (see SLOT_CONSUMING_REASONS in src/lib/program.js), so a three-week injury
--     stored that way would silently burn twenty-one slots. A day annotation may
--     point at an injury via day_annotations.injury_id (added below); that link
--     is the only thing joining the two.
--
--     `kind` is 'joint' (area is an id from JOINT_AREAS in src/lib/injuryConfig.js)
--     or 'muscle' (area is an engine muscle name). `status` is active | managing
--     | resolved.
--
--     checkins  — [{ id, date, pain 0-10, note }], the pain trend
--     rehab     — [{ id, date, kind, note }], what you DID about it. Separate
--                 from checkins because one is an observation and the other an
--                 action; together they answer "is it healing" and "am I doing
--                 anything about it", which are different questions.
--     verdicts  — { exerciseId: 'hurts' | 'ok' }, the user overriding our guess
--                 about which movements aggravate it
--     All three are jsonb rather than tables of their own: small, never queried
--     apart from their injury, and atomic to save alongside a status change.
-- ---------------------------------------------------------------------------
create table if not exists public.injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  area text not null,
  side text,
  label text,
  status text not null default 'active',
  started_at timestamptz not null,
  resolved_at timestamptz,
  note text,
  checkins jsonb not null default '[]'::jsonb,
  rehab jsonb not null default '[]'::jsonb,
  verdicts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- `rehab` shipped after the table did, so the create above is skipped on any
-- database that already has it — this is the line that actually adds the column
-- for existing installs. The client retries the save without it when it's
-- missing (missingRehabColumn in src/lib/workoutRemote.js).
alter table public.injuries add column if not exists rehab jsonb not null default '[]'::jsonb;

alter table public.injuries enable row level security;

drop policy if exists "Users can view their own injuries" on public.injuries;
create policy "Users can view their own injuries"
  on public.injuries for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own injuries" on public.injuries;
create policy "Users can insert their own injuries"
  on public.injuries for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own injuries" on public.injuries;
create policy "Users can update their own injuries"
  on public.injuries for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own injuries" on public.injuries;
create policy "Users can delete their own injuries"
  on public.injuries for delete using (auth.uid() = user_id);

create index if not exists injuries_user_started_idx on public.injuries (user_id, started_at desc);

-- The optional link from "I couldn't train on the 14th" to the injury that
-- explains it. Added after day_annotations shipped, so it's an ALTER rather than
-- a column in the create above — and the client retries without it when the
-- column is missing (missingInjuryIdColumn in src/lib/workoutRemote.js), so an
-- un-migrated database loses the link and nothing else.
alter table public.day_annotations
  add column if not exists injury_id uuid references public.injuries(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2g) EXERCISE_NOTES — each user's per-movement notes (form cues, machine
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
-- 2h) CLIENTS — the coach's client list: each client's name, profile, notes and
--     the programs written for them. One row per coach; the whole list is a
--     single JSON array, same pattern as PROGRAMS/EXERCISE_NOTES. Only ever
--     read and written by the account that owns it.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

drop policy if exists "Users can view their own clients" on public.clients;
create policy "Users can view their own clients"
  on public.clients for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own clients" on public.clients;
create policy "Users can insert their own clients"
  on public.clients for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own clients" on public.clients;
create policy "Users can update their own clients"
  on public.clients for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own clients" on public.clients;
create policy "Users can delete their own clients"
  on public.clients for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2i) COACHING — a client card (2h) linked to the client's real account.
--
--     The coach makes an invite for one card; the client opens the link,
--     signs in and accepts. While that link is ACTIVE the coach can read the
--     client's log, weight, injuries, day markers, program and profile — never
--     write to them — and the client can end it any time. Every coach-read
--     policy goes through is_coach_of(), so ending the link cuts access on the
--     very next request.
--
--     coach_links is written only through the functions below (no insert /
--     update policies), so a status or client_id can't be forged from the app.
--     card_id is the id of the card inside the coach's clients.data array.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  card_id text not null,
  code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'ended')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  ended_at timestamptz
);

-- One coach at a time per client.
create unique index if not exists coach_links_one_active_per_client
  on public.coach_links (client_id) where status = 'active';
create index if not exists coach_links_coach_idx on public.coach_links (coach_id, status);

alter table public.coach_links enable row level security;

drop policy if exists "Coach and client can view their links" on public.coach_links;
create policy "Coach and client can view their links"
  on public.coach_links for select using (auth.uid() = coach_id or auth.uid() = client_id);

-- True while the signed-in user is the ACTIVE coach of `target`. Security
-- definer so the policies that call it don't run coach_links' own RLS.
create or replace function public.is_coach_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_links
    where coach_id = auth.uid() and client_id = target and status = 'active'
  );
$$;

-- The name the client goes by, saved when they accept — the coach can't read
-- an email, and a card made from the join link needs something to be called.
alter table public.coach_links add column if not exists client_name text;

-- COACH_JOIN_CODES — the coach's one permanent link (/join/<code>), for anyone.
-- Whoever accepts it gets a brand-new card in the coach's list, already
-- linked. Resetting replaces the code, so a link that got around stops
-- working. Read by the coach only; written only through the functions below.
create table if not exists public.coach_join_codes (
  coach_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.coach_join_codes enable row level security;

drop policy if exists "Coach can view their join code" on public.coach_join_codes;
create policy "Coach can view their join code"
  on public.coach_join_codes for select using (auth.uid() = coach_id);

-- The coach's join code, made on first ask. `p_reset` swaps in a new one.
create or replace function public.coach_join_code(p_reset boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and is_coach) then
    raise exception 'Only the coach can invite' using errcode = '42501';
  end if;
  if not p_reset then
    select code into c from public.coach_join_codes where coach_id = auth.uid();
    if found then
      return c;
    end if;
  end if;
  insert into public.coach_join_codes (coach_id, code)
    values (auth.uid(), replace(gen_random_uuid()::text, '-', ''))
    on conflict (coach_id) do update set code = excluded.code, created_at = now()
    returning code into c;
  return c;
end;
$$;

-- A fresh invite for one card. Only the coach account (profiles.is_coach,
-- which the app can't set — see protect_profile_flags). A new invite replaces
-- the card's open one; a card that's already linked can't get another.
create or replace function public.create_coach_invite(p_card_id text)
returns public.coach_links language plpgsql security definer set search_path = public as $$
declare
  l public.coach_links;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and is_coach) then
    raise exception 'Only the coach can invite' using errcode = '42501';
  end if;
  if p_card_id is null or char_length(p_card_id) = 0 or char_length(p_card_id) > 100 then
    raise exception 'Bad card id' using errcode = '22023';
  end if;
  if exists (select 1 from public.coach_links where coach_id = auth.uid() and card_id = p_card_id and status = 'active') then
    raise exception 'Already linked' using errcode = '23505';
  end if;
  update public.coach_links set status = 'ended', ended_at = now()
    where coach_id = auth.uid() and card_id = p_card_id and status = 'pending';
  -- gen_random_uuid() is 122 random bits: unguessable, and built in.
  insert into public.coach_links (coach_id, card_id, code)
    values (auth.uid(), p_card_id, replace(gen_random_uuid()::text, '-', ''))
    returning * into l;
  return l;
end;
$$;

-- What the invite page shows before anyone accepts: whose invite it is and
-- whether it still works. Callable signed out, so the page can say who's
-- asking before the sign-in prompt. Says nothing about any client.
create or replace function public.invite_info(p_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  l public.coach_links;
  j public.coach_join_codes;
  coach_name text;
begin
  -- The coach's permanent join link: always open.
  select * into j from public.coach_join_codes where code = p_code;
  if found then
    select display_name into coach_name from public.profiles where id = j.coach_id;
    return json_build_object(
      'state', case when exists (
        select 1 from public.coach_links
        where coach_id = j.coach_id and client_id = auth.uid() and status = 'active'
      ) then 'linked' else 'open' end,
      'coach_name', coalesce(nullif(coach_name, ''), 'Leon'),
      'is_self', auth.uid() is not null and j.coach_id = auth.uid()
    );
  end if;
  select * into l from public.coach_links where code = p_code;
  if not found then
    return json_build_object('state', 'invalid');
  end if;
  select display_name into coach_name from public.profiles where id = l.coach_id;
  return json_build_object(
    'state', case when l.status <> 'pending' then 'used' when l.expires_at < now() then 'expired' else 'open' end,
    'coach_name', coalesce(nullif(coach_name, ''), 'Leon'),
    'is_self', auth.uid() is not null and l.coach_id = auth.uid()
  );
end;
$$;

-- The client says yes. Ends any coach they already had (one at a time).
create or replace function public.accept_coach_invite(p_code text)
returns public.coach_links language plpgsql security definer set search_path = public as $$
declare
  l public.coach_links;
  j public.coach_join_codes;
  me text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  -- What the coach will call this client: their nickname, else the part of
  -- their email before the @.
  select coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1)) into me
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = auth.uid();

  -- The coach's permanent join link: a new card, linked straight away.
  select * into j from public.coach_join_codes where code = p_code;
  if found then
    if j.coach_id = auth.uid() then
      raise exception 'That is your own invite' using errcode = '22023';
    end if;
    -- Already this coach's client: nothing to do.
    select * into l from public.coach_links
      where coach_id = j.coach_id and client_id = auth.uid() and status = 'active';
    if found then
      return l;
    end if;
    update public.coach_links set status = 'ended', ended_at = now()
      where client_id = auth.uid() and status = 'active';
    insert into public.coach_links (coach_id, client_id, card_id, code, status, accepted_at, expires_at, client_name)
      values (j.coach_id, auth.uid(), 'join-' || replace(gen_random_uuid()::text, '-', ''),
              replace(gen_random_uuid()::text, '-', ''), 'active', now(), now(), me)
      returning * into l;
    return l;
  end if;

  select * into l from public.coach_links where code = p_code for update;
  if not found or l.status <> 'pending' or l.expires_at < now() then
    raise exception 'Invite not valid' using errcode = 'P0002';
  end if;
  if l.coach_id = auth.uid() then
    raise exception 'That is your own invite' using errcode = '22023';
  end if;
  update public.coach_links set status = 'ended', ended_at = now()
    where client_id = auth.uid() and status = 'active';
  update public.coach_links set client_id = auth.uid(), status = 'active', accepted_at = now(), client_name = me
    where id = l.id
    returning * into l;
  return l;
end;
$$;

-- Either side ends a link (or the coach withdraws an open invite).
create or replace function public.end_coach_link(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.coach_links set status = 'ended', ended_at = now()
    where id = p_id and status in ('pending', 'active')
      and (coach_id = auth.uid() or client_id = auth.uid());
$$;

-- The client's side: who coaches me, and since when. The coach's name lives
-- in their profile, which the client can't read directly.
create or replace function public.my_coach()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'link_id', l.id,
    'coach_id', l.coach_id,
    'coach_name', coalesce(nullif(p.display_name, ''), 'Leon'),
    'since', l.accepted_at
  )
  from public.coach_links l
  left join public.profiles p on p.id = l.coach_id
  where l.client_id = auth.uid() and l.status = 'active'
  limit 1;
$$;

-- The coach READS a linked client's data. These sit beside each table's
-- "view their own" policy (policies OR together); there are no coach write
-- policies on any of them.
drop policy if exists "Coach can view a linked client's profile" on public.profiles;
create policy "Coach can view a linked client's profile"
  on public.profiles for select using (public.is_coach_of(id));
drop policy if exists "Coach can view a linked client's sessions" on public.sessions;
create policy "Coach can view a linked client's sessions"
  on public.sessions for select using (public.is_coach_of(user_id));
drop policy if exists "Coach can view a linked client's bodyweight" on public.bodyweight_log;
create policy "Coach can view a linked client's bodyweight"
  on public.bodyweight_log for select using (public.is_coach_of(user_id));
drop policy if exists "Coach can view a linked client's program" on public.programs;
create policy "Coach can view a linked client's program"
  on public.programs for select using (public.is_coach_of(user_id));
drop policy if exists "Coach can view a linked client's injuries" on public.injuries;
create policy "Coach can view a linked client's injuries"
  on public.injuries for select using (public.is_coach_of(user_id));
drop policy if exists "Coach can view a linked client's day annotations" on public.day_annotations;
create policy "Coach can view a linked client's day annotations"
  on public.day_annotations for select using (public.is_coach_of(user_id));

-- COACH_PROGRAMS — a split the coach sends to a linked client. The client's
-- app copies it into their own programs (2c), locked, and picks up every later
-- edit; `id` is the program's id on both sides. The client only sees rows from
-- their CURRENT coach, so ending the link unlocks their copy.
create table if not exists public.coach_programs (
  id text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  make_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists coach_programs_client_idx on public.coach_programs (client_id);

alter table public.coach_programs enable row level security;

drop policy if exists "Coach and client can view sent programs" on public.coach_programs;
create policy "Coach and client can view sent programs"
  on public.coach_programs for select using (
    auth.uid() = coach_id
    or (auth.uid() = client_id and exists (
      select 1 from public.coach_links l
      where l.client_id = auth.uid() and l.coach_id = coach_programs.coach_id and l.status = 'active'
    ))
  );
drop policy if exists "Coach can send programs" on public.coach_programs;
create policy "Coach can send programs"
  on public.coach_programs for insert with check (auth.uid() = coach_id and public.is_coach_of(client_id));
drop policy if exists "Coach can update sent programs" on public.coach_programs;
create policy "Coach can update sent programs"
  on public.coach_programs for update using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id and public.is_coach_of(client_id));
drop policy if exists "Coach can stop sending programs" on public.coach_programs;
create policy "Coach can stop sending programs"
  on public.coach_programs for delete using (auth.uid() = coach_id);

-- COACH_NOTES — what the coach says to a client: a comment on a session
-- (target_id = session id), a reply to a check-in (target_id = check-in id),
-- or a general note. The client marks them read through the function below.
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'general' check (kind in ('session', 'checkin', 'general')),
  target_id text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists coach_notes_client_idx on public.coach_notes (client_id, created_at desc);

alter table public.coach_notes enable row level security;

drop policy if exists "Coach and client can view notes" on public.coach_notes;
create policy "Coach and client can view notes"
  on public.coach_notes for select using (auth.uid() = coach_id or auth.uid() = client_id);
drop policy if exists "Coach can write notes" on public.coach_notes;
create policy "Coach can write notes"
  on public.coach_notes for insert
  with check (auth.uid() = coach_id and public.is_coach_of(client_id) and read_at is null);
drop policy if exists "Coach can delete notes" on public.coach_notes;
create policy "Coach can delete notes"
  on public.coach_notes for delete using (auth.uid() = coach_id);

create or replace function public.mark_coach_notes_read(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update public.coach_notes set read_at = now()
    where client_id = auth.uid() and id = any(p_ids) and read_at is null;
$$;

-- COACH_TARGETS — the numbers the coach sets for a client: goal weight,
-- calories, protein, carbs, fat ({ goalWeight, unit, calories, protein,
-- carbs, fat }). One row per client.
create table if not exists public.coach_targets (
  client_id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.coach_targets enable row level security;

drop policy if exists "Coach and client can view targets" on public.coach_targets;
create policy "Coach and client can view targets"
  on public.coach_targets for select using (auth.uid() = client_id or public.is_coach_of(client_id));
drop policy if exists "Coach can set targets" on public.coach_targets;
create policy "Coach can set targets"
  on public.coach_targets for insert with check (auth.uid() = coach_id and public.is_coach_of(client_id));
drop policy if exists "Coach can change targets" on public.coach_targets;
create policy "Coach can change targets"
  on public.coach_targets for update using (public.is_coach_of(client_id))
  with check (auth.uid() = coach_id and public.is_coach_of(client_id));

-- CHECKINS — the client's weekly check-in: 1-5 scores and a note
-- ({ sleep, energy, stress, training, hunger, diet, note }). One per week,
-- keyed by the week's Monday. The client's own; the coach reads while linked.
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.checkins enable row level security;

drop policy if exists "Client and coach can view check-ins" on public.checkins;
create policy "Client and coach can view check-ins"
  on public.checkins for select using (auth.uid() = user_id or public.is_coach_of(user_id));
drop policy if exists "Users can insert their own check-ins" on public.checkins;
create policy "Users can insert their own check-ins"
  on public.checkins for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own check-ins" on public.checkins;
create policy "Users can update their own check-ins"
  on public.checkins for update using (auth.uid() = user_id);
drop policy if exists "Users can delete their own check-ins" on public.checkins;
create policy "Users can delete their own check-ins"
  on public.checkins for delete using (auth.uid() = user_id);

-- WEEKLY_LOG — food and body fat, once a week (added 2026-10-06): the week's
-- average calories and protein a day, and body fat when they measured it.
-- Everyone's, coached or not; a coached client fills it in with the check-in
-- (same Monday key). The coach reads while linked. Weigh-ins stay daily in
-- bodyweight_log.
create table if not exists public.weekly_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  calories int check (calories between 0 and 20000),
  protein int check (protein between 0 and 1000),
  body_fat numeric check (body_fat between 4 and 65),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_log enable row level security;

drop policy if exists "Client and coach can view the weekly log" on public.weekly_log;
create policy "Client and coach can view the weekly log"
  on public.weekly_log for select using (auth.uid() = user_id or public.is_coach_of(user_id));
drop policy if exists "Users can insert their own weekly log" on public.weekly_log;
create policy "Users can insert their own weekly log"
  on public.weekly_log for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own weekly log" on public.weekly_log;
create policy "Users can update their own weekly log"
  on public.weekly_log for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own weekly log" on public.weekly_log;
create policy "Users can delete their own weekly log"
  on public.weekly_log for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2j) MESSAGES — a chat between the coach and one linked client, with photos
--     and short videos. Only the two of them, and only while their link is
--     ACTIVE: unlinking hides the whole conversation from both sides.
--     A message is text, a file in the private chat-media bucket, or both.
--     read_at is set only through mark_messages_read (no update policy).
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text check (char_length(body) <= 4000),
  media_path text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (body is not null or media_path is not null)
);

-- Added 2026-10-06. reply_to: the message this one answers (a deleted
-- original leaves the reply standing). card: something from the app shared
-- into the chat — an exercise, a split, a workout or a weekly check-in — as a
-- snapshot, so it reads the same later (shape in lib/chatCards.js).
alter table public.messages add column if not exists reply_to uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists card jsonb;
-- The first version's "text or a file" rule would turn a card-only message
-- away; drop it whatever Postgres named it.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%media_path IS NOT NULL%'
      and pg_get_constraintdef(oid) not like '%card%'
  loop
    execute format('alter table public.messages drop constraint %I', c.conname);
  end loop;
end;
$$;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check
  check (body is not null or media_path is not null or card is not null);
alter table public.messages drop constraint if exists messages_card_size;
alter table public.messages add constraint messages_card_size
  check (card is null or octet_length(card::text) <= 100000);

create index if not exists messages_pair_idx on public.messages (coach_id, client_id, created_at desc);

alter table public.messages enable row level security;

-- True while the signed-in user is one of the two people in an ACTIVE link.
-- Takes text so the storage policies can pass folder names straight in.
create or replace function public.chat_member(p_coach text, p_client text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and auth.uid()::text in (p_coach, p_client)
    and exists (
      select 1 from public.coach_links
      where coach_id::text = p_coach and client_id::text = p_client and status = 'active'
    );
$$;

drop policy if exists "Chat members can view messages" on public.messages;
create policy "Chat members can view messages"
  on public.messages for select using (public.chat_member(coach_id::text, client_id::text));
drop policy if exists "Chat members can send messages" on public.messages;
create policy "Chat members can send messages"
  on public.messages for insert with check (
    sender_id = auth.uid() and read_at is null and public.chat_member(coach_id::text, client_id::text)
  );
drop policy if exists "Senders can delete their messages" on public.messages;
create policy "Senders can delete their messages"
  on public.messages for delete using (sender_id = auth.uid());

-- Everything the other person sent in this chat, marked read.
create or replace function public.mark_messages_read(p_coach uuid, p_client uuid)
returns void language sql security definer set search_path = public as $$
  update public.messages set read_at = now()
    where coach_id = p_coach and client_id = p_client
      and sender_id <> auth.uid() and read_at is null
      and public.chat_member(p_coach::text, p_client::text);
$$;

-- New messages arrive live (Supabase Realtime, which applies the select
-- policy above). Added only once — adding twice is an error.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- REACTIONS — one emoji per person per message; picking another replaces it.
-- Same rule as the messages: only the two people in an active link.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reactions enable row level security;

create or replace function public.chat_message_member(p_message uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message and public.chat_member(m.coach_id::text, m.client_id::text)
  );
$$;

drop policy if exists "Chat members can view reactions" on public.message_reactions;
create policy "Chat members can view reactions"
  on public.message_reactions for select using (public.chat_message_member(message_id));
drop policy if exists "Chat members can react" on public.message_reactions;
create policy "Chat members can react"
  on public.message_reactions for insert with check (user_id = auth.uid() and public.chat_message_member(message_id));
drop policy if exists "Chat members can change their reaction" on public.message_reactions;
create policy "Chat members can change their reaction"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.chat_message_member(message_id));
drop policy if exists "Chat members can remove their reaction" on public.message_reactions;
create policy "Chat members can remove their reaction"
  on public.message_reactions for delete using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end;
$$;

-- CHAT-MEDIA — the photos and videos. Private: every file is fetched through
-- a short-lived signed link. Path: <coach_id>/<client_id>/<file>, so the
-- policies can check the link from the folder names. 50 MB a file (the free
-- plan's cap).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Chat members can view chat media" on storage.objects;
create policy "Chat members can view chat media"
  on storage.objects for select using (
    bucket_id = 'chat-media'
    and public.chat_member((storage.foldername(name))[1], (storage.foldername(name))[2])
  );
drop policy if exists "Chat members can upload chat media" on storage.objects;
create policy "Chat members can upload chat media"
  on storage.objects for insert with check (
    bucket_id = 'chat-media'
    and public.chat_member((storage.foldername(name))[1], (storage.foldername(name))[2])
  );
drop policy if exists "Uploaders can delete their chat media" on storage.objects;
create policy "Uploaders can delete their chat media"
  on storage.objects for delete using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 2k) COMMUNITY — a feed the coach's clients share with each other: a caption,
--     something from the app (a workout, a split or an exercise — shape in
--     lib/chatCards.js; check-ins stay between client and coach), or both.
--     Emoji reactions and comments under each post.
--     One community per coach: the coach and every client with an ACTIVE link.
--     Someone who leaves drops out — their posts and comments are hidden, not
--     deleted, and come back if they rejoin. Nothing is editable; the author or
--     the coach deletes.
-- ---------------------------------------------------------------------------
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text check (char_length(body) <= 1000),
  card jsonb check (card is null or (octet_length(card::text) <= 100000 and card->>'type' in ('workout', 'split', 'exercise'))),
  created_at timestamptz not null default now(),
  check (body is not null or card is not null)
);

create index if not exists community_posts_feed_idx on public.community_posts (coach_id, created_at desc);

alter table public.community_posts enable row level security;

-- True while the signed-in user belongs to this coach's community: they're the
-- coach (profiles.is_coach, which the app can't set), or one of their active
-- clients.
create or replace function public.community_member(p_coach uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    (auth.uid() = p_coach and exists (select 1 from public.profiles where id = p_coach and is_coach))
    or exists (
      select 1 from public.coach_links
      where coach_id = p_coach and client_id = auth.uid() and status = 'active'
    )
  );
$$;

-- True while BOTH the signed-in user and `p_author` belong to the community —
-- what every read asks, so someone who left drops out of everyone's feed. Only
-- answers for a member, so it can't be used to look up who coaches whom.
create or replace function public.community_sees(p_coach uuid, p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.community_member(p_coach) and (
    (p_author = p_coach and exists (select 1 from public.profiles where id = p_coach and is_coach))
    or exists (
      select 1 from public.coach_links
      where coach_id = p_coach and client_id = p_author and status = 'active'
    )
  );
$$;

drop policy if exists "Members can view community posts" on public.community_posts;
create policy "Members can view community posts"
  on public.community_posts for select using (public.community_sees(coach_id, author_id));
drop policy if exists "Members can post" on public.community_posts;
create policy "Members can post"
  on public.community_posts for insert with check (author_id = auth.uid() and public.community_member(coach_id));
drop policy if exists "Authors and the coach can delete posts" on public.community_posts;
create policy "Authors and the coach can delete posts"
  on public.community_posts for delete using (author_id = auth.uid() or coach_id = auth.uid());

-- A post the signed-in user can see.
create or replace function public.community_post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_posts p
    where p.id = p_post and public.community_sees(p.coach_id, p.author_id)
  );
$$;

-- REACTIONS — one emoji per person per post; picking another replaces it.
create table if not exists public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.post_reactions enable row level security;

drop policy if exists "Members can view post reactions" on public.post_reactions;
create policy "Members can view post reactions"
  on public.post_reactions for select using (public.community_post_visible(post_id));
drop policy if exists "Members can react to posts" on public.post_reactions;
create policy "Members can react to posts"
  on public.post_reactions for insert with check (user_id = auth.uid() and public.community_post_visible(post_id));
drop policy if exists "Members can change their post reaction" on public.post_reactions;
create policy "Members can change their post reaction"
  on public.post_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.community_post_visible(post_id));
drop policy if exists "Members can remove their post reaction" on public.post_reactions;
create policy "Members can remove their post reaction"
  on public.post_reactions for delete using (user_id = auth.uid());

-- COMMENTS — short text under a post.
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

alter table public.post_comments enable row level security;

-- A comment the signed-in user can see: its post is visible and its author is
-- still in the community.
create or replace function public.community_comment_visible(p_post uuid, p_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_posts p
    where p.id = p_post
      and public.community_sees(p.coach_id, p.author_id)
      and public.community_sees(p.coach_id, p_author)
  );
$$;

-- The coach of the community a post is in (for someone who can see the post).
create or replace function public.community_post_coach(p_post uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coach_id from public.community_posts
  where id = p_post and public.community_sees(coach_id, author_id);
$$;

drop policy if exists "Members can view comments" on public.post_comments;
create policy "Members can view comments"
  on public.post_comments for select using (public.community_comment_visible(post_id, author_id));
drop policy if exists "Members can comment" on public.post_comments;
create policy "Members can comment"
  on public.post_comments for insert with check (author_id = auth.uid() and public.community_post_visible(post_id));
drop policy if exists "Authors and the coach can delete comments" on public.post_comments;
create policy "Authors and the coach can delete comments"
  on public.post_comments for delete using (author_id = auth.uid() or public.community_post_coach(post_id) = auth.uid());

-- Names in the feed. Clients can't read each other's profiles, so this hands
-- out just the nickname — for the signed-in member only, and only for people
-- who've posted or commented (a client who just reads is never named).
create or replace function public.community_names(p_coach uuid)
returns table (id uuid, name text, is_coach boolean)
language sql stable security definer set search_path = public as $$
  select p.id,
    case when p.id = p_coach then coalesce(nullif(trim(p.display_name), ''), 'Leon') else nullif(trim(p.display_name), '') end,
    p.id = p_coach
  from public.profiles p
  where public.community_sees(p_coach, p.id)
    and (
      p.id = p_coach
      or exists (select 1 from public.community_posts cp where cp.coach_id = p_coach and cp.author_id = p.id)
      or exists (
        select 1 from public.post_comments c join public.community_posts cp on cp.id = c.post_id
        where cp.coach_id = p_coach and c.author_id = p.id
      )
    );
$$;

-- Live feed (Realtime applies the select policies above). Added only once.
do $$
declare t text;
begin
  foreach t in array array['community_posts', 'post_reactions', 'post_comments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

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
