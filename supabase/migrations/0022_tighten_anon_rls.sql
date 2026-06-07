-- Tighten RLS on three tables that today are readable by anon via
-- the public REST endpoint. The browser anon key would let any
-- visitor curl these tables directly without an account.
--
-- This migration only restricts SELECT. Writes were already gated
-- to service-role (no INSERT/UPDATE/DELETE policies = default deny).
--
-- After this lands:
--   - anon role: blocked from these tables.
--   - authenticated role: allowed to SELECT (lesson player, audio
--     playback, admin pages all sign in first; middleware redirects
--     unauth visitors away from any path that reads them).
--   - service_role: bypasses RLS entirely (admin tooling unaffected).
--
-- Plan-tier gating (e.g. free-tier accounts limited to free lessons)
-- is a separate, larger change. The minimum fix is: anon → denied,
-- attributable account → allowed. Free signups are open today so
-- this isn't perfect, but it stops un-attributable mass scraping
-- and forces an account that can be banned for abuse.

-- ---------- M4: lesson_turns ----------
-- The single biggest exposure: every paid lesson's full content
-- (questions, answer choices, hints) was readable to anon, so the
-- paid curriculum could be scraped without ever buying a plan.
drop policy if exists "turns_read" on public.lesson_turns;
create policy "turns_read"
  on public.lesson_turns
  for select
  to authenticated
  using (true);

-- ---------- M3: lesson_audio_assets ----------
drop policy if exists "audio_assets_read_all" on public.lesson_audio_assets;
create policy "audio_assets_read"
  on public.lesson_audio_assets
  for select
  to authenticated
  using (true);

-- ---------- M3: lesson_audio_manifest ----------
drop policy if exists "audio_manifest_read_all" on public.lesson_audio_manifest;
create policy "audio_manifest_read"
  on public.lesson_audio_manifest
  for select
  to authenticated
  using (true);

-- ---------- M2: yaml_generation_jobs ----------
-- App-side code reading this table (app/yaml-generate/page.tsx and
-- app/yaml-status/page.tsx) already uses the service-role client
-- directly, so there's no legitimate non-service reader to
-- accommodate. Drop the policy entirely; default-deny applies.
drop policy if exists "yaml_jobs_read_all" on public.yaml_generation_jobs;
