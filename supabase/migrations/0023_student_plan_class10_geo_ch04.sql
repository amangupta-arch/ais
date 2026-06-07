-- Adds the fifth school-curriculum bundle: Class 10 Geography, Chapter 4
-- (Agriculture, NCERT Contemporary India II, Reprint 2026-27).
--
-- Why:
--   Follows Class 10 Math (0014) and Geography Ch.1-3 (0020/0021/0022) as
--   the next 'student'-tier chapter. The 'student' plan row and the
--   bundles.plan_tier CHECK that admits 'student' already exist from 0014,
--   so this migration is JUST the bundle insert.
--
--   Tagged class:10 + subject:geography + curriculum. board:* and medium:*
--   tags are synced from the bundle's YAML
--   (supabase/content/bundle-courses/16-class10-geo-ch04.yaml) by
--   scripts/load-bundle-courses.ts, matching the Ch.1-3 pattern.
--
-- Idempotent — safe to re-run.

insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-10-geography-ch04-agriculture',
  'student',
  '🌾',
  'ember',
  530,
  '{class:10,subject:geography,curriculum}',
  '{"en":{"title":"Class 10 Geography · Ch.4 Agriculture","description":"Two-thirds of India lives off the land — but how? Master NCERT''s Agriculture chapter: the three farming systems from slash-and-burn jhumming to capital-heavy plantations, the Rabi-Kharif-Zaid cropping calendar, the geography of India''s major crops from rice and wheat to cotton, tea and pulses, and the technological and institutional reforms — the Green and White Revolutions, the Kisan Credit Card, and Vinoba Bhave''s Bhoodan movement — that reshaped the Indian farm."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
