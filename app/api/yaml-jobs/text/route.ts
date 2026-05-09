/** GET /api/yaml-jobs/text?course=…&lesson=…&language=…
 *
 *  Returns the raw YAML text for a lesson, in two-tier order:
 *    1. yaml_generation_jobs.yaml_text — what the generator wrote
 *    2. supabase/content/<course>[/<course>-<lang>]/NN-<slug>.yaml on disk
 *       (covers lessons authored before this pipeline, e.g. chatgpt-basics)
 *
 *  Used by the "view yaml" links on /yaml-status and /yaml-generate.
 *  Public — same trust model as /yaml-status.
 */

import { readFileSync } from "node:fs";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  enumerateAllLessons,
  lessonYamlExists,
  lessonYamlPath,
} from "@/lib/yaml-generation/catalog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courseSlug = url.searchParams.get("course");
  const lessonSlug = url.searchParams.get("lesson");
  const language = url.searchParams.get("language") ?? "en";
  if (!courseSlug || !lessonSlug) {
    return new Response("missing course or lesson", { status: 400 });
  }

  // Try the job row first.
  let text: string | null = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && key) {
    const admin = createServiceClient(supabaseUrl, key, {
      auth: { persistSession: false },
    });
    const { data } = await admin
      .from("yaml_generation_jobs")
      .select("yaml_text")
      .eq("course_slug", courseSlug)
      .eq("lesson_slug", lessonSlug)
      .eq("language", language)
      .maybeSingle();
    text = (data?.yaml_text as string | null) ?? null;
  }

  // Fall back to on-disk file if the job row has nothing (e.g. lessons
  // authored before the generator pipeline existed).
  if (!text) {
    const entry = enumerateAllLessons().find(
      (e) => e.courseSlug === courseSlug && e.lessonSlug === lessonSlug,
    );
    if (entry && lessonYamlExists(entry, language)) {
      try {
        text = readFileSync(lessonYamlPath(entry, language), "utf8");
      } catch {
        // fall through to 404
      }
    }
  }

  if (!text) return new Response("not found", { status: 404 });
  return new Response(text, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
