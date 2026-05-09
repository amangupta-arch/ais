/** /yaml-generate — pick bundle → course → lesson → language and click
 *  Start. The actual generation happens in /api/yaml-jobs/generate; this
 *  page just gathers the catalog of authored lesson titles and the
 *  current job state so the client picker can show "already done /
 *  failed / queued / not started" per row.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  enumerateAllLessons,
  lessonYamlExists,
} from "@/lib/yaml-generation/catalog";

import GenerateForm, { type CatalogRow, type JobRow } from "./GenerateForm";

export const dynamic = "force-dynamic";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

async function loadBundleTitleMap(): Promise<Record<string, string>> {
  const admin = adminClient();
  if (!admin) return {};
  const { data } = await admin
    .from("bundles")
    .select("slug, translations");
  const map: Record<string, string> = {};
  for (const b of data ?? []) {
    const t = (b.translations as Record<string, { title?: string }> | null) ?? {};
    map[b.slug as string] = t.en?.title ?? (b.slug as string);
  }
  return map;
}

async function loadJobRows(): Promise<JobRow[]> {
  const admin = adminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("yaml_generation_jobs")
    .select(
      "course_slug, lesson_slug, language, status, attempts, started_at, finished_at, yaml_path, error, model",
    );
  return (data ?? []) as JobRow[];
}

export default async function YamlGeneratePage() {
  const entries = enumerateAllLessons();
  const [bundleTitles, jobs] = await Promise.all([
    loadBundleTitleMap(),
    loadJobRows(),
  ]);

  const rows: CatalogRow[] = entries.map((e) => ({
    bundleSlug: e.bundleSlug,
    bundleTitle: bundleTitles[e.bundleSlug] ?? e.bundleSlug,
    courseSlug: e.courseSlug,
    courseTitle: e.courseTitle,
    lessonSlug: e.lessonSlug,
    lessonTitle: e.lessonTitle,
    lessonIndex: e.lessonIndex,
    courseLessonCount: e.courseLessonCount,
    enExists: lessonYamlExists(e, "en"),
  }));

  return (
    <main style={{ minHeight: "100dvh", background: "#FAFAFA", padding: "32px 16px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <a
            href="/yaml-status"
            style={{
              fontSize: 12,
              color: "#475569",
              textDecoration: "none",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            ← yaml status
          </a>
          <h1 style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: "#0F172A" }}>
            Generate lesson YAML
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
            Pick a bundle → course → lesson → language and click <strong>Start</strong>.
            Calls Claude Sonnet 4.6 with{" "}
            <code style={{ fontSize: 13 }}>docs/lesson-yaml-knowledge.md</code> as the
            system prompt, validates against <code style={{ fontSize: 13 }}>lessonSchema</code>,
            writes the file under <code style={{ fontSize: 13 }}>supabase/content/</code> and
            upserts into <code style={{ fontSize: 13 }}>lesson_turns</code>. One lesson per
            request, ~30–60s.
          </p>
        </header>

        <GenerateForm rows={rows} initialJobs={jobs} />
      </div>
    </main>
  );
}
