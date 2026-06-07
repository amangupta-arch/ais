-- Adds the second school-curriculum bundle: Class 10 Geography, Chapter 1
-- (Resources and Development, NCERT Contemporary India II).
--
-- Why:
--   Follows Class 10 Math (migration 0014) as the second 'student'-tier
--   chapter. The 'student' plan row and the bundles.plan_tier CHECK that
--   admits 'student' already exist from 0014, so this migration is JUST
--   the bundle insert.
--
--   Tagged class:10 + subject:geography + curriculum. board:* and medium:*
--   tags are synced from the bundle's YAML
--   (supabase/content/bundle-courses/13-class10-geo-ch01.yaml) by
--   scripts/load-bundle-courses.ts, matching the Math pattern.
--
-- Idempotent — safe to re-run.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-10-geography-ch01-resources-and-development',
  'student',
  '🌍',
  'moss',
  500,
  '{class:10,subject:geography,curriculum}',
  '{"en":{"title":"Class 10 Geography · Ch.1 Resources and Development","description":"What turns nature''s raw material into a resource? Master NCERT''s opening chapter — the three tests of a resource, the four ways to classify them, why sustainable development and planning matter, and how India''s land and soils are used, degraded, and conserved."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
