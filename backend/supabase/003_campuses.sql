-- MiniTag 003: several universities.
-- Each campus has its own buildings (and so rooms) and campus places, and each
-- person can say which campus they study at. Run after schema.sql and
-- 002_buildings_rooms.sql. Safe to re-run.

create table if not exists public.campuses (
  id          bigint generated always as identity primary key,
  slug        text not null unique,              -- 'pau', 'unilag' ...
  name        text not null,                     -- 'Pan-Atlantic University'
  short_name  text not null,                     -- 'PAU'
  area        text,                              -- 'Ibeju-Lekki, Lagos'
  osm_id      text unique,                       -- campus outline in OpenStreetMap
  centre_lat  double precision not null,
  centre_lon  double precision not null,
  boundary    jsonb check (boundary is null or boundary->>'type' = 'Polygon'),
  created_at  timestamptz not null default now()
);

alter table public.campuses enable row level security;

drop policy if exists "campuses: anyone can read" on public.campuses;
create policy "campuses: anyone can read" on public.campuses for select to anon, authenticated using (true);
drop policy if exists "campuses: admins write" on public.campuses;
create policy "campuses: admins write" on public.campuses for all to authenticated
  using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

grant select on public.campuses to anon, authenticated;
grant insert, update, delete on public.campuses to authenticated;  -- admins only (RLS)

-- Link buildings, campus places and profiles to a campus.
alter table public.campus_buildings add column if not exists campus_id bigint references public.campuses (id) on delete cascade;
alter table public.campus_places    add column if not exists campus_id bigint references public.campuses (id) on delete cascade;
alter table public.profiles         add column if not exists campus_id bigint references public.campuses (id) on delete set null;
create index if not exists campus_buildings_campus_idx on public.campus_buildings (campus_id);
create index if not exists campus_places_campus_idx    on public.campus_places (campus_id);

-- Pan-Atlantic University was the first campus; its buildings are already loaded.
insert into public.campuses (slug, name, short_name, area, osm_id, centre_lat, centre_lon)
values ('pau', 'Pan-Atlantic University', 'PAU', 'Ibeju-Lekki, Lagos', 'way/746433946', 6.4855, 3.8557)
on conflict (slug) do nothing;

update public.campus_buildings set campus_id = (select id from public.campuses where slug = 'pau') where campus_id is null;
update public.campus_places    set campus_id = (select id from public.campuses where slug = 'pau') where campus_id is null;

notify pgrst, 'reload schema';

select c.short_name, count(b.id) as buildings
from public.campuses c left join public.campus_buildings b on b.campus_id = c.id
group by c.short_name order by c.short_name;
