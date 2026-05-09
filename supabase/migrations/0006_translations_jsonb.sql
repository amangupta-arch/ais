-- TRANSLATION REFACTOR — PHASE 1 (additive)
--
-- Goal: shift courses + lessons from "one row per language, linked by
-- course_group_id / lesson_group_id" to "one row per concept, with
-- translations jsonb keyed by language code" — matching the existing
-- pattern on `bundles.translations`.
--
-- This phase is purely additive. We:
--   1. Add `translations` jsonb columns to courses + lessons.
--   2. Backfill them from the existing title/subtitle/description columns
--      AND fold in any sibling rows linked via course_group_id /
--      lesson_group_id.
--
-- Old columns (title, subtitle, description, language_code, *_group_id)
-- are NOT dropped here. The app keeps reading them and continues to work
-- exactly as before. Phase 2 will collapse the sibling rows; phase 3
-- migrates lesson_turns content; phase 4 switches queries to read from
-- translations; phase 5 drops the legacy columns.

-- ---------------------------------------------------------------- COURSES

alter table courses
  add column translations jsonb not null default '{}'::jsonb;

-- Backfill: for every course in a multilingual group, gather every
-- sibling's text fields into one jsonb keyed by language_code. For loner
-- courses, just self-translate.

with sibling_translations as (
  select
    course_group_id,
    jsonb_object_agg(
      language_code,
      jsonb_strip_nulls(jsonb_build_object(
        'title',       title,
        'subtitle',    subtitle,
        'description', description
      ))
    ) as t
  from courses
  where course_group_id is not null
  group by course_group_id
)
update courses c
set translations = s.t
from sibling_translations s
where c.course_group_id = s.course_group_id;

update courses c
set translations = jsonb_build_object(
  c.language_code,
  jsonb_strip_nulls(jsonb_build_object(
    'title',       c.title,
    'subtitle',    c.subtitle,
    'description', c.description
  ))
)
where c.course_group_id is null
  and c.translations = '{}'::jsonb;

-- ---------------------------------------------------------------- LESSONS

alter table lessons
  add column translations jsonb not null default '{}'::jsonb;

-- Lessons mirror courses. lesson_group_id may be null even within a
-- multilingual course (because group ids weren't always backfilled at
-- the lesson level). Two passes: grouped first, loners second.

with sibling_translations as (
  select
    lesson_group_id,
    jsonb_object_agg(
      language_code,
      jsonb_strip_nulls(jsonb_build_object(
        'title',    title,
        'subtitle', subtitle
      ))
    ) as t
  from lessons
  where lesson_group_id is not null
  group by lesson_group_id
)
update lessons l
set translations = s.t
from sibling_translations s
where l.lesson_group_id = s.lesson_group_id;

update lessons l
set translations = jsonb_build_object(
  l.language_code,
  jsonb_strip_nulls(jsonb_build_object(
    'title',    l.title,
    'subtitle', l.subtitle
  ))
)
where l.lesson_group_id is null
  and l.translations = '{}'::jsonb;

-- ---------------------------------------------------------------- INDEXES

-- GIN on translations supports `translations ? 'hinglish'` containment
-- queries used by the future dashboard at /database-schema.
create index idx_courses_translations on courses using gin (translations);
create index idx_lessons_translations on lessons using gin (translations);
