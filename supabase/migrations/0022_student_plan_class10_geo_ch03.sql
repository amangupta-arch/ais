-- Adds the Class 10 Geography Chapter 3 bundle (Water Resources, NCERT
-- Contemporary India II). Follows Math (0014), Geo Ch.1 (0020), Geo Ch.2
-- (0021) on the existing 'student' plan tier. Plan row + plan_tier CHECK
-- already exist, so this is JUST the bundle insert.
--
-- board:* / medium:* tags sync from the bundle YAML
-- (bundle-courses/15-class10-geo-ch03.yaml) via load-bundle-courses.ts.
-- Idempotent.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-10-geography-ch03-water-resources',
  'student',
  '💧',
  'paper',
  520,
  '{class:10,subject:geography,curriculum}',
  '{"en":{"title":"Class 10 Geography · Ch.3 Water Resources","description":"Water covers three-quarters of the planet and is endlessly recycled — so why will two billion people face scarcity by 2025? Explore the puzzle of water scarcity, the promise and price of multi-purpose dams (the temples of modern India), and the ancient and modern art of harvesting the rain."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
