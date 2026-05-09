/** Loads the canonical English YAML for a lesson, in two-tier order:
 *    1. supabase/content/<course-slug>/NN-<lesson-slug>.yaml on disk
 *    2. yaml_generation_jobs.yaml_text for (course, lesson, "en")
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

/** Returns the EN YAML for a lesson, or null if neither disk nor DB has it. */
export async function loadEnYamlText(entry: LessonEntry): Promise<string | null> {
  if (lessonYamlExists(entry, "en")) {
    try {
      return readFileSync(lessonYamlPath(entry, "en"), "utf8");
    } catch {
      // fall through to DB
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createServiceClient(url, key, { auth: { persistSession: false } });
  const { data } = await admin
    .from("yaml_generation_jobs")
    .select("yaml_text")
    .eq("course_slug", entry.courseSlug)
    .eq("lesson_slug", entry.lessonSlug)
    .eq("language", "en")
    .maybeSingle();
  return (data?.yaml_text as string | null) ?? null;
}
