/** Loads the YAML of every previously-authored lesson in the same
 *  bundle as `entry`, packs them into a single delimited string for the
 *  generator user-prompt, and applies a token cap (oldest-dropped-first)
 *  so very long bundles don't blow past Sonnet 4.6's context window.
 *
 *  Same two-tier source-of-truth as en-source.ts:
 *    1. yaml_generation_jobs.yaml_text  (fresh after regenerations on Vercel)
 *    2. supabase/content/<course>/NN-<lesson>.yaml  (lessons authored
 *       before the generator pipeline + the GH-Actions sync target)
 *
 *  EN-only on purpose: translations only need the EN base of the SAME
 *  lesson — cross-lesson continuity is already baked into the EN YAML
 *  they're translating from.
 *
 *  Server-only — uses node:fs and the Supabase service role.
 */

import { readFileSync } from "node:fs";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  enumerateAllLessons,
  lessonYamlExists,
  lessonYamlPath,
  type LessonEntry,
} from "./catalog";

export type PriorLessonRef = {
  courseSlug: string;
  courseTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonIndex: number;
  yamlText: string;
};

export type PriorBundleContent = {
  /** Lessons included in the packed promptText (after any truncation). */
  lessons: PriorLessonRef[];
  /** Lessons we found prior YAML for but had to drop to fit the budget. */
  droppedCount: number;
  /** Total prior lessons discovered (included + dropped). */
  totalCount: number;
  /** Approximate token budget consumed by the packed promptText. */
  approxTokens: number;
  /** Concatenated, delimited string ready to embed as the prior-context
   *  section of the user prompt. Empty string when no prior lessons
   *  exist in this bundle. */
  promptText: string;
};

type LoadOptions = {
  /** Approximate cap on tokens consumed by the packed promptText.
   *  Defaults to 120K — generous for a 200K-context Sonnet 4.6 call,
   *  leaves plenty of headroom for the lesson body, system prompt, and
   *  output. Drop the oldest lessons first if we exceed it. */
  tokenBudget?: number;
};

const DEFAULT_TOKEN_BUDGET = 120_000;

/** Cheap heuristic — chars / 3.5 ≈ tokens for English-ish text. Good
 *  enough for a packing decision; we don't need real tokenisation. */
function approxTokenCount(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function formatLesson(ref: PriorLessonRef): string {
  return [
    `--- COURSE: ${ref.courseTitle} (${ref.courseSlug}) · LESSON ${String(ref.lessonIndex).padStart(2, "0")}: ${ref.lessonTitle} ---`,
    ref.yamlText.trim(),
  ].join("\n");
}

/** Returns every lesson that appears BEFORE `entry` in the same bundle,
 *  in catalog order (earlier courses first, then earlier lessons in
 *  this course). Excludes `entry` itself. */
function priorEntriesInBundle(entry: LessonEntry): LessonEntry[] {
  const all = enumerateAllLessons();
  const idx = all.findIndex(
    (e) => e.courseSlug === entry.courseSlug && e.lessonSlug === entry.lessonSlug,
  );
  if (idx < 0) return [];
  return all
    .slice(0, idx)
    .filter((e) => e.bundleSlug === entry.bundleSlug);
}

function makeAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}
type AdminClient = NonNullable<ReturnType<typeof makeAdmin>>;

/** Tries DB first, then disk, returns null if neither has EN YAML. */
async function loadEnYamlForEntry(
  admin: AdminClient | null,
  e: LessonEntry,
): Promise<string | null> {
  if (admin) {
    const { data } = await admin
      .from("yaml_generation_jobs")
      .select("yaml_text, status")
      .eq("course_slug", e.courseSlug)
      .eq("lesson_slug", e.lessonSlug)
      .eq("language", "en")
      .maybeSingle();
    const row = data as { yaml_text?: string | null } | null;
    const text = row?.yaml_text ?? null;
    if (text) return text;
  }
  if (lessonYamlExists(e, "en")) {
    try {
      return readFileSync(lessonYamlPath(e, "en"), "utf8");
    } catch {
      // ignore
    }
  }
  return null;
}

export async function loadBundlePriorContent(
  entry: LessonEntry,
  opts?: LoadOptions,
): Promise<PriorBundleContent> {
  const tokenBudget = opts?.tokenBudget ?? DEFAULT_TOKEN_BUDGET;
  const priorEntries = priorEntriesInBundle(entry);
  if (priorEntries.length === 0) {
    return {
      lessons: [],
      droppedCount: 0,
      totalCount: 0,
      approxTokens: 0,
      promptText: "",
    };
  }

  const admin = makeAdmin();

  // Load every prior lesson's YAML in parallel — most of the wall-clock
  // is the DB lookup, and they're independent.
  const loaded: PriorLessonRef[] = [];
  await Promise.all(
    priorEntries.map(async (e) => {
      const yamlText = await loadEnYamlForEntry(admin, e);
      if (!yamlText) return;
      loaded.push({
        courseSlug: e.courseSlug,
        courseTitle: e.courseTitle,
        lessonSlug: e.lessonSlug,
        lessonTitle: e.lessonTitle,
        lessonIndex: e.lessonIndex,
        yamlText,
      });
    }),
  );

  // Re-sort to catalog order (parallel load lost it).
  const orderIdx = new Map(
    priorEntries.map((e, i) => [`${e.courseSlug}::${e.lessonSlug}`, i]),
  );
  loaded.sort(
    (a, b) =>
      (orderIdx.get(`${a.courseSlug}::${a.lessonSlug}`) ?? 0) -
      (orderIdx.get(`${b.courseSlug}::${b.lessonSlug}`) ?? 0),
  );

  const totalCount = loaded.length;
  if (totalCount === 0) {
    return {
      lessons: [],
      droppedCount: 0,
      totalCount: 0,
      approxTokens: 0,
      promptText: "",
    };
  }

  // Pack from newest backwards (closest-to-`entry` is most relevant)
  // until budget is exhausted, then re-sort the kept slice into catalog
  // order for the prompt.
  const reversed = [...loaded].reverse();
  const kept: PriorLessonRef[] = [];
  let approxTokens = 0;
  for (const ref of reversed) {
    const formatted = formatLesson(ref);
    const cost = approxTokenCount(formatted) + 4; // +4 for the joiner blank lines
    if (approxTokens + cost > tokenBudget) break;
    kept.push(ref);
    approxTokens += cost;
  }
  kept.reverse();

  const promptText = kept.map(formatLesson).join("\n\n");

  return {
    lessons: kept,
    droppedCount: totalCount - kept.length,
    totalCount,
    approxTokens,
    promptText,
  };
}
