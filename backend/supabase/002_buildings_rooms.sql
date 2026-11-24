-- =============================================================================
-- MiniTag back end, migration 002: campus buildings, floors and rooms
--
-- Run AFTER schema.sql: Supabase > SQL Editor > New query > paste > Run.
-- Then run seed_pau_buildings.sql to load PAU's building footprints.
--
-- Model (a small GIS of the campus):
--   campus_buildings  one row per building, with its footprint polygon (GeoJSON,
--                     from OpenStreetMap) and its floor count / floor height
--   campus_rooms      rooms inside a building, each on a floor (0 = ground floor),
--                     with an optional centre point and optional room polygon
-- The phone works out the building (footprint + GPS), the floor (barometer) and,
-- where possible, the room. Everything here is public campus data: no personal
-- data, readable by everyone, editable only by admins.
-- =============================================================================

create table public.campus_buildings (
  id              bigint generated always as identity primary key,
  osm_id          text unique,                     -- e.g. 'way/746433961'; null for buildings added by hand
  name            text check (name is null or char_length(trim(name)) between 1 and 120),
  category        text not null default 'Building',
  levels          integer check (levels is null or levels between 1 and 50),  -- number of floors above ground
  floor_height_m  real not null default 3.5 check (floor_height_m between 2 and 8),
  footprint       jsonb not null,                  -- GeoJSON Polygon: {"type":"Polygon","coordinates":[[[lon,lat],...]]}
  verified        boolean not null default false,
  updated_at      timestamptz not null default now(),
  constraint footprint_is_polygon check (footprint->>'type' = 'Polygon')
);

create table public.campus_rooms (
  id           bigint generated always as identity primary key,
  building_id  bigint not null references public.campus_buildings (id) on delete cascade,
  name         text not null check (char_length(trim(name)) between 1 and 80),   -- e.g. 'Classroom 2'
  floor        integer not null default 0 check (floor between -3 and 50),         -- 0 = ground floor, 1 = first floor
  kind         text not null default 'Room',                                       -- Classroom, Lab, Office, Library ...
  latitude     double precision check (latitude  is null or latitude  between -90  and 90),
  longitude    double precision check (longitude is null or longitude between -180 and 180),
  footprint    jsonb check (footprint is null or footprint->>'type' = 'Polygon'),  -- from a floor plan, if available
  verified     boolean not null default false,
  updated_at   timestamptz not null default now(),
  unique (building_id, floor, name)
);
create index campus_rooms_building on public.campus_rooms (building_id, floor);

alter table public.campus_buildings enable row level security;
alter table public.campus_rooms     enable row level security;

create policy "campus_buildings: anyone can read" on public.campus_buildings for select to anon, authenticated using (true);
create policy "campus_rooms: anyone can read"     on public.campus_rooms     for select to anon, authenticated using (true);

create policy "campus_buildings: admins write" on public.campus_buildings for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
create policy "campus_rooms: admins write" on public.campus_rooms for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

-- Lets the app show admin-only tools (like "Add a room") without exposing the admins table.
create function public.am_i_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- Least-privilege grants (the project does not grant table access automatically).
grant select on public.campus_buildings, public.campus_rooms to anon, authenticated;
grant insert, update, delete on public.campus_buildings, public.campus_rooms to authenticated;  -- admins only (RLS)

notify pgrst, 'reload schema';
