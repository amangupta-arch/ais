/** Loads the canonical English YAML for a lesson, in two-tier order:
 *    1. yaml_generation_jobs.yaml_text for (course, lesson, "en")
 *    2. supabase/content/<course-slug>/NN-<lesson-slug>.yaml on disk
 *
 *  DB-first is deliberate; see loadEnYamlText() doc for why.
 *
 *  Used by:
 *    - the generator route, to embed the EN YAML in the prompt when
 *      generating any non-EN translation (so structure + ids stay
 *      aligned with the canonical version)
 *    - the picker page, to decide whether the Start button is enabled
 *      for a non-EN language pick (we refuse translations until EN
 *      exists, to keep the workflow EN-first)
 *
 *  Server-only module — uses fs and the Supabase service role.
 */

import { readFileSync } from "node:fs";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  lessonYamlExists,
  lessonYamlPath,
  type LessonEntry,
} from "./catalog";

/** Returns the EN YAML for a lesson, or null if neither disk nor DB has it.
 *
 *  DB-FIRST order is deliberate. On Vercel the generator persists the
 *  freshly-generated YAML on the job row but skips the disk write
 *  (read-only fs), so an older `supabase/content/<course>/NN-<slug>.yaml`
 *  baked into the deploy can be stale relative to the latest
 *  regeneration. Reading DB first guarantees translations always base
 *  on the most recently generated EN content. Disk is the fallback for
 *  lessons authored before this pipeline existed (no job row), and
 *  also the source-of-truth on local dev where the API writes both. */
export async function loadEnYamlText(entry: LessonEntry): Promise<string | null> {
  // 1. DB row — freshest after a regeneration on Vercel.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const admin = createServiceClient(url, key, { auth: { persistSession: false } });
    const { data } = await admin
      .from("yaml_generation_jobs")
      .select("yaml_text, status")
      .eq("course_slug", entry.courseSlug)
      .eq("lesson_slug", entry.lessonSlug)
      .eq("language", "en")
      .maybeSingle();
    const text = data?.yaml_text as string | null | undefined;
    if (text && (data?.status === "done" || data?.status === "failed" || data?.status === "running")) {
      // Use whatever's stored; "done" is the common path. We deliberately
      // accept text from non-done rows too because if any text exists the
      // generator already validated it before persisting.
      return text;
    }
  }

  // 2. On-disk file — the only source for lessons authored before the
  //    generator pipeline existed (chatgpt-basics, nlp-basics, etc.).
  if (lessonYamlExists(entry, "en")) {
    try {
      return readFileSync(lessonYamlPath(entry, "en"), "utf8");
    } catch {
      // ignore
    }
  }

  return null;
}
