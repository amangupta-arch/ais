-- One active subscription per (user, plan). Cashfree retries the
-- webhook on transient errors, and the previous check-then-insert
-- logic in /api/webhooks/cashfree was racy — two concurrent retries
-- could both pass the "does an active sub exist?" lookup and each
-- insert a row, leaving the user with duplicate billings.
--
-- This partial unique index is the floor: even if the application
-- retries skip the lookup, the second INSERT fails with 23505 and
-- the webhook treats it as already-granted.
--
-- Status filter in the WHERE so a later cancelled row + a new active
-- row is allowed (re-subscription after cancel).

create unique index if not exists subscriptions_one_active_per_user_plan
  on public.subscriptions (user_id, plan_id)
  where status = 'active';
