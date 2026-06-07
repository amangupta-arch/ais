-- Codex P1 follow-up on PR #67 (M5).
--
-- The application-side allowlist in app/(app)/profile/actions.ts
-- only protects calls routed through that server action. The
-- profiles_self_all RLS policy in 0001_init.sql is `for all using
-- (auth.uid() = id)` — it confines writes to the caller's OWN row
-- but doesn't constrain WHICH COLUMNS the caller can touch. With a
-- normal session token, a user can call the public Supabase JS
-- client (or curl PostgREST) and set arbitrary columns:
--
--   await sb.from("profiles")
--     .update({ email: "victim@evil", onboarding_completed_at: "..." })
--     .eq("id", user.id);
--
-- This bypasses the server-action allowlist entirely. The right
-- fix is at the database layer: column-level GRANTs.
--
-- After this migration:
--   - email, id, created_at, updated_at: NOT in the grant →
--     direct UPDATEs from `authenticated` are denied at the
--     planner level, before RLS even runs.
--   - everything else: writable, matching the columns the live
--     /join/finalize, /onboarding/complete, and /profile flows
--     legitimately set.
--   - service_role still bypasses grants (admin tooling untouched).
--   - The touch_updated_at trigger does not issue an UPDATE
--     statement — it mutates NEW directly — so it doesn't need
--     UPDATE privilege on updated_at to keep working.

revoke update on table public.profiles from authenticated;

grant update (
  display_name,
  avatar_url,
  first_name,
  city,
  primary_goal,
  current_level,
  role,
  interests,
  struggle_subjects,
  native_language,
  preferred_language,
  daily_goal_minutes,
  daily_reminder_time,
  preferred_tutor_persona,
  school_class,
  education_board,
  state_board,
  institute,
  onboarding_completed_at
) on table public.profiles to authenticated;
