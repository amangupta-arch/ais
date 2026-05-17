-- Adds quiz answers to profiles so the /join funnel can write them
-- in one go. Most learner data already lives on profiles (email,
-- preferred_language, school_class, native_language); these four
-- columns close the gap for the launch funnel.
--
-- Why on profiles, not a separate quiz_responses table:
--   - Single read path. /home + /student can use the same profile
--     row to personalise without joining another table.
--   - The quiz is meant to be the start of an ever-evolving
--     profile — we want the user to update first_name / city /
--     subjects from /profile later without us migrating their
--     answer out of a "quiz response" table.
--   - One table to back up, one table to RLS.
--
-- If we later want a historical snapshot for analytics ("what
-- subjects did learners report struggling with when they joined,
-- vs now?"), we'll add a quiz_responses append-only table.

alter table profiles
  add column if not exists first_name text;

alter table profiles
  add column if not exists city text;

alter table profiles
  add column if not exists education_board text;

alter table profiles
  add column if not exists struggle_subjects text[] default '{}';

-- Loose format guard on education_board — slug-shaped. Lets us
-- show "CBSE" / "ICSE" / "State (Maharashtra)" cleanly in the UI
-- while keeping the stored value normalised.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_education_board_format_chk') then
    alter table profiles
      add constraint profiles_education_board_format_chk
      check (education_board is null or education_board ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;
