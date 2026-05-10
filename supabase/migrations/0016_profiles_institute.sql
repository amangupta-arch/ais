-- Adds the `institute` layer above `school_class` and relaxes
-- school_class to a text identifier so it can carry college program
-- codes like 'bba-sem-01' alongside K-12 grade strings like '10'.
--
-- Why:
--   The /student dashboard now serves two posture-different audiences:
--     - K-12 learners        → institute = null, school_class = '10'
--     - Higher-ed cohorts    → institute = 'nmims', school_class =
--                              'bba-sem-01'
--   Curriculum bundles are tagged with the matching `institute:X` and
--   `class:Y` so a user only ever sees their own track.
--
-- Migration:
--   1. Drop the smallint range CHECK from PR #44.
--   2. Convert school_class from smallint to text (existing values
--      like 10 become '10' — bundle tags use 'class:10' so the filter
--      keeps matching seamlessly).
--   3. Add institute text (nullable, lowercase slug-safe).
--   4. New format CHECKs in place of the old range CHECK.
--   5. Index institute for the small subset that actually has one.
--
-- Idempotent — safe to re-run.

-- 1. Drop the old check constraint.
alter table profiles drop constraint if exists profiles_school_class_range_chk;

-- 2. Convert smallint → text.
alter table profiles
  alter column school_class type text
  using school_class::text;

-- 3. Add institute column.
alter table profiles
  add column if not exists institute text;

-- 4. Format checks. Both columns share the same slug-safe pattern:
--    lowercase letters / digits / hyphens, 1..40 chars, optional.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_school_class_format_chk') then
    alter table profiles
      add constraint profiles_school_class_format_chk
      check (school_class is null or school_class ~ '^[a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_institute_format_chk') then
    alter table profiles
      add constraint profiles_institute_format_chk
      check (institute is null or institute ~ '^[a-z0-9-]{1,40}$');
  end if;
end $$;

-- 5. Index for institute filtering.
create index if not exists idx_profiles_institute on profiles(institute)
  where institute is not null;
