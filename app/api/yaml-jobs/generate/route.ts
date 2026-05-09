/**
 * POST /api/yaml-jobs/generate
 *
 * Generate one lesson YAML and persist it to disk + DB. Triggered from
 * /yaml-generate. Long-running (≈30–60s per call) — needs maxDuration
 * past Vercel Hobby's 10s ceiling.
 *
 * Body: { courseSlug: string, lessonSlug: string, language: string }
 *
 * Side effects per call:
 *  1. Inserts/updates a yaml_generation_jobs row (queued → running →
 *     done|failed) so /yaml-status can render progress without polling
 *     the API.
 *  2. Calls Anthropic Sonnet 4.6 with docs/lesson-yaml-knowledge.md
 *     baked in as the system prompt, retries up to 3× on validation
 *     failure.
 *  3. Writes the validated YAML to supabase/content/<course>/NN-<slug>.yaml
 *     (or <course>-<lang>/... for translations).
 *  4. Calls submitLessonYaml() to upsert the same content into the DB so
 *     the lesson goes live immediately.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

import { submitLessonYaml } from "@/app/update-yaml/actions";
import { LANGUAGE_OPTIONS } from "@/app/update-yaml/constants";
import { createClient } from "@/lib/supabase/server";
import { enumerateAllLessons } from "@/lib/yaml-generation/catalog";
import { GENERATOR_MODEL, generateLessonYaml } from "@/lib/yaml-generation/generate";
import { writeLessonYaml } from "@/lib/yaml-generation/persist";

const ALLOWED_LANGS: ReadonlySet<string> = new Set(LANGUAGE_OPTIONS.map((l) => l.code));

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — Vercel Pro/Enterprise

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

type Body = {
  courseSlug?: string;
  lessonSlug?: string;
  language?: string;
};

export async function POST(req: Request) {
  // Cookie-based auth: only signed-in users can spend Anthropic credits.
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Not signed in." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }
  const courseSlug = body.courseSlug?.trim();
  const lessonSlug = body.lessonSlug?.trim();
  const language = body.language?.trim() || "en";

  if (!courseSlug || !lessonSlug) {
    return NextResponse.json(
      { ok: false, message: "Missing courseSlug or lessonSlug." },
      { status: 400 },
    );
  }
  // Allowlist the language code BEFORE any filesystem touch — the value
  // flows into directory + file path construction in writeLessonYaml.
  if (!ALLOWED_LANGS.has(language)) {
    return NextResponse.json(
      { ok: false, message: `Unsupported language "${language}".` },
      { status: 400 },
    );
  }

  // Resolve the catalog entry (source of truth for slug + ordering).
  const entry = enumerateAllLessons().find(
    (e) => e.courseSlug === courseSlug && e.lessonSlug === lessonSlug,
  );
  if (!entry) {
    return NextResponse.json(
      { ok: false, message: `Unknown lesson: ${courseSlug}/${lessonSlug}` },
      { status: 404 },
    );
  }

  const admin = adminClient();

  // Resolve the courseId so submitLessonYaml can target the right row.
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id")
    .eq("slug", entry.courseSlug)
    .maybeSingle();
  if (courseErr) {
    return NextResponse.json(
      { ok: false, message: `course lookup: ${courseErr.message}` },
      { status: 500 },
    );
  }
  if (!course) {
    return NextResponse.json(
      {
        ok: false,
        message: `Course "${entry.courseSlug}" not in DB. Run scripts/load-bundle-courses.ts first.`,
      },
      { status: 409 },
    );
  }

  // Mark the job as running. Upsert so re-runs reset state cleanly.
  const startedAt = new Date().toISOString();
  const { error: jobErr } = await admin.from("yaml_generation_jobs").upsert(
    {
      bundle_slug: entry.bundleSlug,
      course_slug: entry.courseSlug,
      course_title: entry.courseTitle,
      lesson_slug: entry.lessonSlug,
      lesson_title: entry.lessonTitle,
      lesson_index: entry.lessonIndex,
      language,
      status: "running",
      attempts: 0,
      model: GENERATOR_MODEL,
      yaml_path: null,
      error: null,
      started_at: startedAt,
      finished_at: null,
    },
    { onConflict: "course_slug,lesson_slug,language" },
  );
  if (jobErr) {
    return NextResponse.json(
      { ok: false, message: `record job: ${jobErr.message}` },
      { status: 500 },
    );
  }

  const finalize = async (
    fields: Record<string, unknown>,
  ) => {
    await admin
      .from("yaml_generation_jobs")
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq("course_slug", entry.courseSlug)
      .eq("lesson_slug", entry.lessonSlug)
      .eq("language", language);
  };

  // 1. Generate.
  const gen = await generateLessonYaml({ entry, language });
  if (!gen.ok) {
    await finalize({ status: "failed", attempts: gen.attempts, error: gen.message });
    return NextResponse.json(
      { ok: false, stage: "generate", message: gen.message, attempts: gen.attempts },
      { status: 502 },
    );
  }

  // Persist the generated YAML on the row IMMEDIATELY, before any disk
  // or DB write. Even if the next stages fail, we keep the text so the
  // user can recover it from /yaml-status without re-spending Anthropic
  // credits.
  await admin
    .from("yaml_generation_jobs")
    .update({ attempts: gen.attempts, yaml_text: gen.yamlText })
    .eq("course_slug", entry.courseSlug)
    .eq("lesson_slug", entry.lessonSlug)
    .eq("language", language);

  // 2. Write to disk — best-effort. Vercel serverless filesystems are
  // read-only outside /tmp, so on the deployed instance we deliberately
  // skip this step (the YAML is already preserved on the job row +
  // applied to DB below). Locally and on any non-Vercel runtime, we
  // still write to the canonical path so git diffs continue to work.
  let yamlPath: string | null = null;
  let diskNote: string | null = null;
  if (process.env.VERCEL === "1") {
    diskNote = "skipped on Vercel (read-only fs); copy YAML from /yaml-status to commit.";
  } else {
    try {
      yamlPath = writeLessonYaml(entry, language, gen.yamlText);
    } catch (e) {
      diskNote = `skipped: ${String(e)}`;
    }
  }

  // 3. Auto-load into DB via the same path /update-yaml uses, so the
  //    lesson is live immediately.
  const submit = await submitLessonYaml({
    courseId: course.id as string,
    yamlText: gen.yamlText,
    language,
    slug: entry.lessonSlug,
    orderIndex: entry.lessonIndex,
  });
  if (!submit.ok) {
    await finalize({
      status: "failed",
      attempts: gen.attempts,
      yaml_path: yamlPath,
      error: `db apply: ${submit.message}`,
    });
    return NextResponse.json(
      {
        ok: false,
        stage: "apply",
        message: submit.message,
        attempts: gen.attempts,
        yamlPath,
      },
      { status: 500 },
    );
  }

  await finalize({
    status: "done",
    attempts: gen.attempts,
    yaml_path: yamlPath,
    error: diskNote,
  });

  return NextResponse.json({
    ok: true,
    attempts: gen.attempts,
    yamlPath,
    diskNote,
    lesson: submit.lesson,
  });
}
