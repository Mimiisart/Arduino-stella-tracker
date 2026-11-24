-- =============================================================================
-- MiniTag back end: CLEAN START
--
-- Removes everything schema.sql creates, so schema.sql can be run again from
-- scratch. ONLY for setting up or repairing a project with no real data yet:
-- this deletes all profiles, sightings and campus places.
-- (Sign-in accounts in auth.users are kept.)
-- =============================================================================
drop function if exists public.find_sightings(text[]);
drop function if exists public.delete_my_account();
drop table if exists public.campus_places cascade;
drop table if exists public.admins cascade;
drop table if exists public.sightings cascade;
drop table if exists public.profiles cascade;
