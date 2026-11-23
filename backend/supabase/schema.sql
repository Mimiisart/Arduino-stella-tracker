-- =============================================================================
-- MiniTag back end: Supabase (PostgreSQL) schema, stage 1
--
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- It is safe to run once on a new project.
--
-- Privacy design (say this in the defence):
--   * Names live ONLY in `profiles`, linked to the person's sign-in account.
--   * Sightings store ONLY a rotating tag ID, a place and a time. They are never
--     linked to a profile, a tag owner or the person who reported them.
--   * Every table has Row Level Security (RLS): the database itself refuses any
--     read or write the rules below don't allow, whatever the app sends.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Profiles: one row per signed-in student (name + consent)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(trim(display_name)) between 1 and 60),
  consented_at  timestamptz not null default now(),  -- when they agreed to the privacy notice
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each student can see, create and edit only their own profile.
create policy "profiles: read own"   on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);


-- "Delete my data" button: removes the sign-in account. The profile row is
-- removed with it (on delete cascade). Runs with owner rights so a student can
-- delete themselves, but only themselves (auth.uid()).
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- -----------------------------------------------------------------------------
-- 2. Sightings: community finding ("this tag ID was heard here, at this time")
-- -----------------------------------------------------------------------------
create table public.sightings (
  id           bigint generated always as identity primary key,
  rotating_id  text not null check (rotating_id ~ '^[0-9a-f]{16,64}$'),  -- hex, changes every 15 min
  latitude     double precision not null check (latitude  between -90  and 90),
  longitude    double precision not null check (longitude between -180 and 180),
  accuracy_m   real check (accuracy_m is null or accuracy_m >= 0),
  seen_at      timestamptz not null default now()
  -- Deliberately NO user/finder/owner column: sightings stay anonymous.
);

create index sightings_lookup on public.sightings (rotating_id, seen_at desc);

alter table public.sightings enable row level security;

-- Signed-in students may report a sighting, with a sensible timestamp.
create policy "sightings: report" on public.sightings for insert to authenticated
  with check (seen_at > now() - interval '1 hour' and seen_at < now() + interval '5 minutes');

-- There is NO select policy, so nobody can download the table.
-- Owners look up only the IDs their phone can calculate, through this function:
create function public.find_sightings(ids text[])
returns table (rotating_id text, latitude double precision, longitude double precision,
               accuracy_m real, seen_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if ids is null or cardinality(ids) = 0 or cardinality(ids) > 700 then
    raise exception 'ids must contain 1 to 700 rotating IDs';  -- 700 is about 7 days of 15-minute IDs
  end if;
  return query
    select s.rotating_id, s.latitude, s.longitude, s.accuracy_m, s.seen_at
    from public.sightings s
    where s.rotating_id = any (ids)
      and s.seen_at > now() - interval '7 days'
    order by s.seen_at desc
    limit 100;
end;
$$;

revoke all on function public.find_sightings(text[]) from public, anon;
grant execute on function public.find_sightings(text[]) to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Campus places: the shared campus map (public to read, admins to edit)
-- -----------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies: only the project owner (in the dashboard) can add admins.

create table public.campus_places (
  id           bigint generated always as identity primary key,
  name         text not null check (char_length(trim(name)) between 1 and 80),
  category     text not null default 'Other',
  description  text,
  latitude     double precision not null check (latitude  between -90  and 90),
  longitude    double precision not null check (longitude between -180 and 180),
  radius_m     integer not null default 60 check (radius_m between 10 and 500),
  verified     boolean not null default false,  -- true once checked against an official map or survey
  updated_at   timestamptz not null default now()
);

alter table public.campus_places enable row level security;

create policy "campus_places: anyone can read" on public.campus_places
  for select to anon, authenticated using (true);

create policy "campus_places: admins write" on public.campus_places
  for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));


-- -----------------------------------------------------------------------------
-- 4. Automatic clean-up: delete sightings older than 7 days, every night at 03:00
--    (needs the pg_cron extension: Database > Extensions > pg_cron > enable.
--     If you skip this, find_sightings still ignores anything older than 7 days.)
-- -----------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule('minitag-purge-sightings', '0 3 * * *',
--   $$ delete from public.sightings where seen_at < now() - interval '7 days' $$);
