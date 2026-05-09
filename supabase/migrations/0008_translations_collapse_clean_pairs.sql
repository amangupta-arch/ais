-- TRANSLATION REFACTOR — PHASE 4 (data migration: collapse cleanly-paired siblings)
--
-- Walks every multilingual course pair (canonical EN + sibling Hinglish/etc)
-- and, for each lesson pair where the EN and sibling have IDENTICAL turn
-- counts (i.e. the sibling is a clean translation, not a content variant),
-- folds the sibling's turn text into the canonical turn's translations
-- jsonb keyed by sibling language. Then redirects user progress to the
-- canonical lesson, deletes the sibling lesson, and (if the sibling course
-- has no remaining lessons) deletes the sibling course too.
--
-- Lesson pairs whose turn counts differ are LEFT ALONE — those represent
-- independently-authored content variants, not translations, and the existing
-- redirect logic handles them. Hinglish-only lessons (no canonical match)
-- are also left under the sibling course.
--
-- Two pairs match the clean criterion today:
--   • chatgpt-basics::first-real-conversation        (31 ↔ 31 turns)
--   • math-basic-trigonometry::right-triangles-and-… (16 ↔ 16 turns)
--
-- After this phase:
--   • math-basic-trigonometry-hinglish course is empty → deleted.
--   • chatgpt-basics-hinglish course retains 8 of its 9 lessons (5 divergent
--     + 3 Hinglish-only). The course_group_id link survives.

-- 1. Fold sibling turn content into canonical turn translations.
--    For every cleanly-paired lesson, pair turns by order_index, take the
--    sibling turn's content, and store it under the canonical turn's
--    translations[<sibling language>].

with mergeable_pairs as (
  select
    canonical_l.id   as canonical_lesson_id,
    sibling_l.id     as sibling_lesson_id,
    sibling_c.language_code as sibling_lang
  from courses canonical_c
  join courses sibling_c
    on sibling_c.course_group_id = canonical_c.course_group_id
   and sibling_c.id != canonical_c.id
  join lessons canonical_l on canonical_l.course_id = canonical_c.id
  join lessons sibling_l   on sibling_l.course_id = sibling_c.id
                          and sibling_l.slug = canonical_l.slug
  where canonical_c.language_code = 'en'
    and (select count(*) from lesson_turns t where t.lesson_id = canonical_l.id)
      = (select count(*) from lesson_turns t where t.lesson_id = sibling_l.id)
)
update lesson_turns ct
set translations = ct.translations || jsonb_build_object(p.sibling_lang, st.content)
from mergeable_pairs p
join lesson_turns ct_join on ct_join.lesson_id = p.canonical_lesson_id
join lesson_turns st on st.lesson_id = p.sibling_lesson_id
                    and st.order_index = ct_join.order_index
where ct.id = ct_join.id;

-- 2. Resolve user_lesson_progress conflicts.
--    For users with rows on BOTH siblings, keep the "more progressed" row
--    (completed > in_progress > started > not_started; tiebreak on
--    current_turn_index). Delete the loser.

with mergeable_pairs as (
  select
    canonical_l.id as canonical_lesson_id,
    sibling_l.id   as sibling_lesson_id
  from courses canonical_c
  join courses sibling_c
    on sibling_c.course_group_id = canonical_c.course_group_id
   and sibling_c.id != canonical_c.id
  join lessons canonical_l on canonical_l.course_id = canonical_c.id
  join lessons sibling_l   on sibling_l.course_id = sibling_c.id
                          and sibling_l.slug = canonical_l.slug
  where canonical_c.language_code = 'en'
    and (select count(*) from lesson_turns t where t.lesson_id = canonical_l.id)
      = (select count(*) from lesson_turns t where t.lesson_id = sibling_l.id)
),
status_rank as (
  select 'completed'::text as s, 4 as r
  union all select 'in_progress', 3
  union all select 'started', 2
  union all select 'not_started', 1
),
ranked as (
  select
    p.user_id,
    p.lesson_id,
    pp.canonical_lesson_id,
    pp.sibling_lesson_id,
    sr.r as status_score,
    p.current_turn_index,
    row_number() over (
      partition by p.user_id, pp.canonical_lesson_id
      order by sr.r desc, p.current_turn_index desc, p.updated_at desc
    ) as rn
  from user_lesson_progress p
  join mergeable_pairs pp
    on p.lesson_id in (pp.canonical_lesson_id, pp.sibling_lesson_id)
  left join status_rank sr on sr.s = p.status
)
delete from user_lesson_progress
where id in (
  select p.id
  from user_lesson_progress p
  join ranked r on r.user_id = p.user_id and r.lesson_id = p.lesson_id
  where r.rn > 1
);

-- 3. Redirect remaining sibling-only progress rows to the canonical lesson.
--    Also clear course_id since the course we're attaching to may differ.

with mergeable_pairs as (
  select
    canonical_l.id        as canonical_lesson_id,
    canonical_l.course_id as canonical_course_id,
    sibling_l.id          as sibling_lesson_id
  from courses canonical_c
  join courses sibling_c
    on sibling_c.course_group_id = canonical_c.course_group_id
   and sibling_c.id != canonical_c.id
  join lessons canonical_l on canonical_l.course_id = canonical_c.id
  join lessons sibling_l   on sibling_l.course_id = sibling_c.id
                          and sibling_l.slug = canonical_l.slug
  where canonical_c.language_code = 'en'
    and (select count(*) from lesson_turns t where t.lesson_id = canonical_l.id)
      = (select count(*) from lesson_turns t where t.lesson_id = sibling_l.id)
)
update user_lesson_progress p
set lesson_id = pp.canonical_lesson_id,
    course_id = pp.canonical_course_id
from mergeable_pairs pp
where p.lesson_id = pp.sibling_lesson_id;

-- 4. Repoint user_course_progress.last_lesson_id away from soon-to-be-deleted
--    sibling lessons so the lesson delete doesn't fail FK NO ACTION.

with mergeable_pairs as (
  select
    canonical_l.id as canonical_lesson_id,
    sibling_l.id   as sibling_lesson_id
  from courses canonical_c
  join courses sibling_c
    on sibling_c.course_group_id = canonical_c.course_group_id
   and sibling_c.id != canonical_c.id
  join lessons canonical_l on canonical_l.course_id = canonical_c.id
  join lessons sibling_l   on sibling_l.course_id = sibling_c.id
                          and sibling_l.slug = canonical_l.slug
  where canonical_c.language_code = 'en'
    and (select count(*) from lesson_turns t where t.lesson_id = canonical_l.id)
      = (select count(*) from lesson_turns t where t.lesson_id = sibling_l.id)
)
update user_course_progress cp
set last_lesson_id = pp.canonical_lesson_id
from mergeable_pairs pp
where cp.last_lesson_id = pp.sibling_lesson_id;

-- 5. Delete the sibling lesson rows (turns cascade).

with mergeable_pairs as (
  select sibling_l.id as sibling_lesson_id
  from courses canonical_c
  join courses sibling_c
    on sibling_c.course_group_id = canonical_c.course_group_id
   and sibling_c.id != canonical_c.id
  join lessons canonical_l on canonical_l.course_id = canonical_c.id
  join lessons sibling_l   on sibling_l.course_id = sibling_c.id
                          and sibling_l.slug = canonical_l.slug
  where canonical_c.language_code = 'en'
    and (select count(*) from lesson_turns t where t.lesson_id = canonical_l.id)
      = (select count(*) from lesson_turns t where t.lesson_id = sibling_l.id)
)
delete from lessons where id in (select sibling_lesson_id from mergeable_pairs);

-- 6. Sibling courses with zero remaining lessons get folded into canonical
--    course (resolve user_course_progress conflicts → redirect → delete row).

with empty_siblings as (
  select c.id as sibling_course_id, canonical_c.id as canonical_course_id
  from courses c
  join courses canonical_c
    on canonical_c.course_group_id = c.course_group_id
   and canonical_c.id != c.id
   and canonical_c.language_code = 'en'
  where c.course_group_id is not null
    and c.language_code != 'en'
    and not exists (select 1 from lessons l where l.course_id = c.id)
),
ranked as (
  select
    p.user_id,
    p.course_id,
    es.canonical_course_id,
    es.sibling_course_id,
    case p.status
      when 'completed' then 4 when 'in_progress' then 3
      when 'started' then 2 else 1
    end as status_score,
    row_number() over (
      partition by p.user_id, es.canonical_course_id
      order by case p.status
        when 'completed' then 4 when 'in_progress' then 3
        when 'started' then 2 else 1 end desc,
        p.progress_pct desc, p.updated_at desc
    ) as rn
  from user_course_progress p
  join empty_siblings es
    on p.course_id in (es.canonical_course_id, es.sibling_course_id)
)
delete from user_course_progress
where id in (
  select p.id
  from user_course_progress p
  join ranked r on r.user_id = p.user_id and r.course_id = p.course_id
  where r.rn > 1
);

with empty_siblings as (
  select c.id as sibling_course_id, canonical_c.id as canonical_course_id
  from courses c
  join courses canonical_c
    on canonical_c.course_group_id = c.course_group_id
   and canonical_c.id != c.id
   and canonical_c.language_code = 'en'
  where c.course_group_id is not null
    and c.language_code != 'en'
    and not exists (select 1 from lessons l where l.course_id = c.id)
)
update user_course_progress p
set course_id = es.canonical_course_id
from empty_siblings es
where p.course_id = es.sibling_course_id;

delete from courses c
where c.course_group_id is not null
  and c.language_code != 'en'
  and not exists (select 1 from lessons l where l.course_id = c.id);
