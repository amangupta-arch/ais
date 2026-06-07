-- Adds the third school-curriculum bundle: Class 10 Geography, Chapter 2
-- (Forest and Wildlife Resources, NCERT Contemporary India II).
--
-- Why:
--   Follows Class 10 Math (0014) and Geography Ch.1 (0020) on the existing
--   'student' plan tier. The plan row and the bundles.plan_tier CHECK that
--   admits 'student' already exist, so this migration is JUST the bundle
--   insert.
--
--   Tagged class:10 + subject:geography + curriculum. board:* and medium:*
--   tags are synced from the bundle's YAML
--   (supabase/content/bundle-courses/14-class10-geo-ch02.yaml) by
--   scripts/load-bundle-courses.ts.
--
-- Idempotent — safe to re-run.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-10-geography-ch02-forest-and-wildlife-resources',
  'student',
  '🐯',
  'moss',
  510,
  '{class:10,subject:geography,curriculum}',
  '{"en":{"title":"Class 10 Geography · Ch.2 Forest and Wildlife Resources","description":"India is one of the richest countries on Earth for biodiversity — a web of life we depend on for air, water, and soil. Learn why it matters, how India protects its forests and wildlife (the Wildlife Protection Act, Project Tiger, and the three classes of forest), and how communities from Chipko to the sacred groves have always been nature''s best guardians."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
