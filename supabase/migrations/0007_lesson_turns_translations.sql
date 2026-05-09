-- TRANSLATION REFACTOR — PHASE 3 (additive)
--
-- Adds `translations jsonb` to lesson_turns so language-specific overrides
-- of text-bearing content fields can live alongside the canonical content.
--
-- Convention: content stays as the canonical (English) shape. translations
-- is a jsonb keyed by language code; each value is a partial override of
-- content's text fields. At render time, the app shallow-merges
-- `translations[lang]` on top of `content`.
--
-- Example for a tutor_message turn after phase 4 merges its hinglish
-- sibling:
--   content      : { "text": "Trigonometry sounds intimidating..." }
--   translations : { "hinglish": { "text": "Trigonometry sun ke darr..." } }
--
-- This migration is purely additive — column defaults to '{}' so every
-- existing row keeps rendering exactly as before. The data migration
-- (folding sibling-lesson turns into translations) lives in phase 4.

alter table lesson_turns
  add column translations jsonb not null default '{}'::jsonb;

create index idx_lesson_turns_translations on lesson_turns using gin (translations);
