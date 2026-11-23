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
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and click **Run**.
3. Optional, for automatic clean-up: **Database → Extensions → pg_cron → Enable**,
   then run the two commented lines at the bottom of `schema.sql`.
4. **Authentication → Sign In / Providers → Email**: keep Email enabled. For
   demos, you can turn off **Confirm email** so new accounts work straight away.
5. **Project Settings → API**: copy the **Project URL** and the
   **anon / publishable** key into the app's config.

Never put the **service_role / secret** key or the database password in the app
or share them. The app only ever uses the anon/publishable key; Row Level
Security in `schema.sql` decides what that key may do.

## Making someone an admin

**Table Editor → admins → Insert row**, paste their user ID from
**Authentication → Users**.
