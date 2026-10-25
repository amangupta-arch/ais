-- Class 11 Physics, Chapter 1 (Units and Measurements) — GROUND-UP bundle.
-- For learners who do NOT already know prior-class concepts; teaches the same
-- chapter as the Fast Track bundle (migration 0024) but from zero.
--
-- The 'student' plan row + bundles.plan_tier CHECK admitting 'student' exist
-- from 0014, so this migration is just the bundle insert. class:11 +
-- subject:physics + curriculum + track:ground-up owned here; board:* /
-- medium:* synced from the YAML (18-class11-phy-ch01-ground.yaml) by
-- scripts/load-bundle-courses.ts. Idempotent.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-11-physics-ch01-units-and-measurements-ground-up',
  'student',
  '🌱',
  'moss',
  601,
  '{class:11,subject:physics,curriculum,track:ground-up}',
  '{"en":{"title":"Class 11 Physics · Ch.1 Units and Measurements · Ground-Up","description":"Starts from zero — no prior concepts assumed. Builds every tool as you need it (what a unit is, powers of ten, ratios, estimation) before layering on the physics: the SI system, significant figures and errors, and dimensions as a secret code. Gentle, concrete and unhurried."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
