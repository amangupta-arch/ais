-- TRANSLATION REFACTOR — PHASE 5 (full collapse + drop legacy columns)
--
-- Tail-end of the translation refactor. Removes everything the new model
-- supersedes:
--
-- 1. Deletes the legacy `chatgpt-basics-hinglish` course. It was kept
--    through Phase 4 because its content has drifted from the canonical
--    `chatgpt-basics` (8 of 9 lessons have different turn counts) and
--    couldn't be cleanly merged. Per user direction, we treat it as
--    legacy and drop it. Cascade removes its 8 lessons + ~140 turns +
--    4 user_lesson_progress + course_progress rows.
--
-- 2. Drops the language-linkage columns introduced in 0004:
--    courses.language_code, courses.course_group_id
--    lessons.language_code, lessons.lesson_group_id
--
-- 3. Drops the legacy text columns now superseded by `translations` jsonb:
--    courses.title, courses.subtitle, courses.description
--    lessons.title, lessons.subtitle
--
-- After this migration, every text-bearing field on courses, lessons and
-- lesson_turns lives inside a `translations` jsonb keyed by language code.
-- One row per concept. No siblings. No redirect logic.

-- 1. Drop the legacy alternate-language course.

delete from courses where slug = 'chatgpt-basics-hinglish';

-- 2. Drop indexes that reference the columns we're about to remove.
--    Postgres would cascade-drop these on column drop anyway, but doing
--    it explicitly makes the migration easier to read.

drop index if exists uq_courses_group_language;
drop index if exists uq_lessons_group_language;
drop index if exists idx_courses_language;
drop index if exists idx_courses_group;
drop index if exists idx_lessons_language;
drop index if exists idx_lessons_group;

-- 3. Drop legacy columns from courses.

alter table courses
  drop column if exists language_code,
  drop column if exists course_group_id,
  drop column if exists title,
  drop column if exists subtitle,
  drop column if exists description;

-- 4. Drop legacy columns from lessons.

alter table lessons
  drop column if exists language_code,
  drop column if exists lesson_group_id,
  drop column if exists title,
  drop column if exists subtitle;
