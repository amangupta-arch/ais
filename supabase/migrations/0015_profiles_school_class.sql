-- Adds the learner's school class (e.g. 10) to the profiles table.
-- Drives the /student dashboard, which filters curriculum bundles by
-- the matching `class:N` tag.
--
-- Why a smallint (not enum / text):
--   - K-12 is bounded and small (1-12). smallint + CHECK is enough.
--   - Lets future filtering use range queries (`school_class between
--     6 and 8` for middle-school) without a join.
--
-- Nullable on purpose. Existing users (who joined for AI-tool tracks
-- on Basic/Advanced) don't have a school class. /student will show an
-- inline picker when the field is null instead of stranding them.
--
-- Idempotent — safe to re-run.

alter table profiles
  add column if not exists school_class smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_school_class_range_chk'
  ) then
    alter table profiles
      add constraint profiles_school_class_range_chk
      check (school_class is null or (school_class between 1 and 12));
  end if;
end $$;

create index if not exists idx_profiles_school_class on profiles(school_class)
  where school_class is not null;
