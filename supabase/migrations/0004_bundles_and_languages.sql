-- BUNDLES + LANGUAGE LINKAGE
-- Bundles group basic/advanced courses for plan gating. Free courses have no bundle.
-- Language variants of the same conceptual course/lesson share a *_group_id.

create table bundles (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  plan_tier       text not null check (plan_tier in ('basic','advanced')),
  emoji           text,
  cover_gradient  text default 'paper',
  order_index     int default 0,
  is_published    boolean default true,
  -- per-language { title, description }: { "en": {...}, "hi": {...}, ... }
  translations    jsonb not null default '{}'::jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_bundles_plan_tier   on bundles(plan_tier);
create index idx_bundles_order       on bundles(order_index);

alter table bundles enable row level security;
create policy "bundles_read" on bundles for select using (is_published = true);

-- COURSES: bundle + language linkage
alter table courses
  add column bundle_id        uuid references bundles(id) on delete set null,
  add column language_code    text not null default 'en',
  add column course_group_id  uuid;

-- Free-tier courses must NOT belong to a bundle. Basic/advanced *should* but
-- mappings come later, so we don't enforce NOT NULL on those yet.
alter table courses add constraint courses_free_no_bundle_chk
  check (plan_tier <> 'free' or bundle_id is null);

create index idx_courses_bundle_id   on courses(bundle_id);
create index idx_courses_language    on courses(language_code);
create index idx_courses_group       on courses(course_group_id);

-- A course-group can have at most one course per language.
create unique index uq_courses_group_language
  on courses(course_group_id, language_code)
  where course_group_id is not null;

-- LESSONS: language linkage (lessons inherit bundle from their course)
alter table lessons
  add column language_code   text not null default 'en',
  add column lesson_group_id uuid;

create index idx_lessons_language on lessons(language_code);
create index idx_lessons_group    on lessons(lesson_group_id);

create unique index uq_lessons_group_language
  on lessons(lesson_group_id, language_code)
  where lesson_group_id is not null;

-- Backfill: link the existing Hinglish course to its English sibling.
-- (Done here so the live DB is consistent immediately; seed.sql mirrors this.)
do $$
declare
  v_group uuid := uuid_generate_v4();
begin
  update courses set course_group_id = v_group, language_code = 'en'
    where slug = 'chatgpt-basics';
  update courses set course_group_id = v_group, language_code = 'hinglish'
    where slug = 'chatgpt-basics-hinglish';
end $$;
