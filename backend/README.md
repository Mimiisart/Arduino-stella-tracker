# MiniTag back end (Supabase)

MiniTag's cloud back end is a free **Supabase** project: a hosted PostgreSQL
database with sign-in (Supabase Auth) and an automatic API. The app talks to it
directly; there is no custom server to run.

## What it stores

| Table | Contents | Who can read | Who can write |
|---|---|---|---|
| `profiles` | Student's display name, consent time | Only that student | Only that student |
| `sightings` | Rotating tag ID, latitude/longitude, accuracy, time | Nobody directly; owners look up their own IDs via `find_sightings()` | Any signed-in student (anonymous reports) |
| `campus_places` | Verified campus buildings and facilities | Everyone | Admins only |
| `admins` | Which accounts may edit campus places | Nobody (dashboard only) | Project owner in the dashboard |

**Not stored:** phone numbers, the link between a tag and its owner, who
reported a sighting, the owner's own location, or any secret keys.

## Set-up (one time)

1. Create a free project at supabase.com (name `minitag`, region closest to campus).
   Save the database password somewhere safe; nobody else needs it.
2. When creating the project, under **Data access**: keep **Enable Data API** on, leave **Grant API access to new tables automatically** off (schema.sql grants exactly what is needed), and turn **Enable RLS on new tables automatically** on.
3. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**.
4. Optional, for automatic clean-up: **Database → Extensions → pg_cron → Enable**,
   then run the two commented lines at the bottom of `schema.sql`.
5. **Authentication → Sign In / Providers → Email**: keep Email enabled. For
   demos, you can turn off **Confirm email** so new accounts work straight away.
6. **Project Settings → API**: copy the **Project URL** and the
   **anon / publishable** key into the app's config.

Never put the **service_role / secret** key or the database password in the app
or share them. The app only ever uses the anon/publishable key; Row Level
Security in `schema.sql` decides what that key may do.

## Campus buildings, floors and rooms (migration 002)

1. **SQL Editor → New query**: paste `supabase/002_buildings_rooms.sql`, **Run**.
2. **New query**: paste `supabase/seed_pau_buildings.sql` (73 PAU building
   footprints from OpenStreetMap), **Run**. Safe to run again later.
3. Make yourself an admin so you can add rooms in the app:
   **Authentication → Users** → copy your user ID → **Table Editor → admins →
   Insert row** → paste it as `user_id` → **Save**.
4. In the app: **Map** tab → tap a building → **Add a room here** (stand in the
   room; the app suggests the floor from the barometer).

How the building, floor and room are worked out: `docs/indoor-location.md`.
Regenerate the footprints from OpenStreetMap: `tools/osm_to_campus.py`.
Map data © OpenStreetMap contributors (ODbL).

## Adding the school's campus places

The app downloads `campus_places`, shows each one as a pin on the Map with search,
and keeps a copy on the phone for offline use. Only collect **real, verified
coordinates** (stand at the entrance with your phone, or long-press the building in
Google/Apple Maps); never guess them.

1. Open `supabase/campus_places_template.csv` in Numbers, Excel or Google Sheets.
2. One row per place:
   - `name`: e.g. Main Library
   - `category`: Academic, Student services, Facilities, Access, Residential, Health, Sports
   - `description`: optional short text
   - `latitude`, `longitude`: decimal degrees, e.g. 6.517400 and 3.385200
   - `radius_m`: rough size of the building or area in metres (10 to 500)
   - `verified`: `true` once checked
3. Export as CSV, then in Supabase: **Table Editor → campus_places → Insert →
   Import data from CSV**.

Single places can also be added with **Insert → Insert row**. The app picks up
changes the next time it opens (it re-checks at most every 6 hours).

## Making someone an admin

**Table Editor → admins → Insert row**, paste their user ID from
**Authentication → Users**.
