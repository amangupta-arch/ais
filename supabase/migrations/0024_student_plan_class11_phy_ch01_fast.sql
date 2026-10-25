-- Class 11 Physics, Chapter 1 (Units and Measurements) — FAST TRACK bundle.
-- For learners who already know all prior-class concepts. Pairs with the
-- Ground-Up bundle (migration 0025), which teaches the same chapter from zero.
--
-- The 'student' plan row + bundles.plan_tier CHECK admitting 'student' exist
-- from 0014, so this migration is just the bundle insert. class:11 +
-- subject:physics + curriculum + track:fast-track owned here; board:* /
-- medium:* synced from the YAML (17-class11-phy-ch01-fast.yaml) by
-- scripts/load-bundle-courses.ts. Idempotent.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-11-physics-ch01-units-and-measurements-fast',
  'student',
  '🚀',
  'ember',
  600,
  '{class:11,subject:physics,curriculum,track:fast-track}',
  '{"en":{"title":"Class 11 Physics · Ch.1 Units and Measurements · Fast Track","description":"For learners already solid on the metric system, powers of ten and basic algebra. Pin down reality the physicist''s way — the SI system as a shared language, significant figures and errors as honesty about precision, and dimensional analysis as a lie-detector that catches a wrong formula on sight."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
