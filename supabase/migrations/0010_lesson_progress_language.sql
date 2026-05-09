-- Add `language` to user_lesson_progress so resume / current_turn_index is
-- scoped to the language the learner was using when the progress was saved.
-- Translation lessons can have a different number of turns than the
-- canonical EN, so a turn index that's valid in one language may overshoot
-- another. When the saved language differs from the user's current
-- preferred_language, the renderer resets to turn 0 instead of trusting
-- the stale index.

alter table user_lesson_progress
  add column if not exists language text not null default 'en';

create index if not exists idx_user_lesson_progress_language
  on user_lesson_progress (language);
