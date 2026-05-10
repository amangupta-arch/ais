-- Adds the 'student' plan tier and the first school-curriculum bundle.
--
-- Why:
--   The product is expanding from AI-tool literacy into school curriculum.
--   Class 10 Mathematics is the first subject; "Real Numbers" is its
--   opening chapter. School content lives on a new 'student' plan so it
--   can be priced separately from the basic / advanced AI-tool plans.
--
-- Changes:
--   1. New row in `plans` for 'student' (₹99 / $1.49 month — stub price,
--      tune later in Stripe).
--   2. Relax bundles.plan_tier CHECK to allow 'student' alongside the
--      existing 'basic' / 'advanced'.
--   3. Insert the first bundle: b-class-10-math-ch01-real-numbers.
--      Tagged with class:10 + subject:mathematics + curriculum so future
--      filtering / grouping can pivot on tags instead of needing a fresh
--      schema migration per subject.
--
-- Idempotent — safe to re-run.

-- 1. New plan row.
insert into plans (
  id, name, tagline, description,
  price_inr, price_usd, billing_period_days,
  streak_unlock_days, max_lessons_per_day,
  features, is_active, sort_order
)
values (
  'student',
  'Student',
  'School, simplified',
  'Curriculum-aligned lessons for school students — math, science, and more, taught the AIS way.',
  99,
  1.49,
  30,
  5,
  1,
  '["Curriculum-aligned chapters","Class 10 Math + Science","Daily 1 lesson","Streak + XP"]'::jsonb,
  true,
  3
)
on conflict (id) do nothing;

-- 2. Relax the bundles.plan_tier check to admit 'student'.
alter table bundles drop constraint if exists bundles_plan_tier_check;
alter table bundles add constraint bundles_plan_tier_check
  check (plan_tier in ('basic', 'advanced', 'student'));

-- 3. The bundle row itself.
insert into bundles (
  slug, plan_tier, emoji, cover_gradient, order_index,
  tags, translations
)
values (
  'b-class-10-math-ch01-real-numbers',
  'student',
  '🔢',
  'paper',
  400,
  '{class:10,subject:mathematics,curriculum}',
  '{"en":{"title":"Class 10 Math · Ch.1 Real Numbers","description":"Master prime factorization, HCF/LCM, and irrational numbers — the building blocks of NCERT Class 10 Real Numbers."}}'::jsonb
)
on conflict (slug) do update set
  plan_tier      = excluded.plan_tier,
  emoji          = excluded.emoji,
  cover_gradient = excluded.cover_gradient,
  order_index    = excluded.order_index,
  tags           = excluded.tags,
  translations   = excluded.translations;
