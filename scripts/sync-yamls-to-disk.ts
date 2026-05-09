#!/usr/bin/env tsx
/**
 * scripts/sync-yamls-to-disk.ts
 *
 * Drains generated lesson YAMLs from `yaml_generation_jobs.yaml_text`
 * onto local disk under supabase/content/. Called by the GitHub Action
 * defined in .github/workflows/sync-yaml-to-repo.yml on a cron + manual
 * trigger; the workflow commits + pushes any new files back to main.
 *
 * Why this exists: Vercel serverless functions can't write to the git
 * repo, so the API route (`/api/yaml-jobs/generate`) only stores the
 * generated YAML in the database. This script puts it back on disk so
 * source-control treats the YAML as the canonical authoring artefact.
 *
 * Idempotent: rows with `status = 'done'` AND `yaml_text IS NOT NULL`
 * are written to their canonical path; if the file content is byte-
 * identical, no write is performed (so git sees no change). After a
 * successful write, the row's `yaml_path` is set so future runs skip
 * disk re-writes for unchanged content.
 *
 * Required env vars (provided as GitHub Secrets):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import {
  enumerateAllLessons,
  lessonYamlPath,
  type LessonEntry,
} from "../lib/yaml-generation/catalog";

type Row = {
  id: string;
  course_slug: string;
  lesson_slug: string;
  language: string;
  yaml_text: string | null;
  yaml_path: string | null;
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

function entryFor(rows: LessonEntry[], course: string, lesson: string): LessonEntry | undefined {
  return rows.find((e) => e.courseSlug === course && e.lessonSlug === lesson);
}

async function main() {
  const sb = admin();
  const { data, error } = await sb
    .from("yaml_generation_jobs")
    .select("id, course_slug, lesson_slug, language, yaml_text, yaml_path")
    .eq("status", "done")
    .not("yaml_text", "is", null);
  if (error) {
    console.error("query failed:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    console.log("nothing to sync.");
    return;
  }

  const catalog = enumerateAllLessons();
  let written = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const r of rows) {
    const entry = entryFor(catalog, r.course_slug, r.lesson_slug);
    if (!entry) {
      console.warn(`skip: no catalog entry for ${r.course_slug}/${r.lesson_slug}`);
      skipped++;
      continue;
    }
    if (!r.yaml_text) {
      skipped++;
      continue;
    }

    const path = lessonYamlPath(entry, r.language);
    const next = r.yaml_text.endsWith("\n") ? r.yaml_text : `${r.yaml_text}\n`;

    let prev: string | null = null;
    if (existsSync(path)) {
      try { prev = readFileSync(path, "utf8"); } catch { /* fall through */ }
    }

    if (prev === next) {
      // File already matches; backfill yaml_path on the row if it's missing
      // so the dashboard reflects "on disk".
      if (!r.yaml_path) {
        await sb.from("yaml_generation_jobs").update({ yaml_path: path }).eq("id", r.id);
      }
      unchanged++;
      continue;
    }

    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, next, "utf8");
    await sb.from("yaml_generation_jobs").update({ yaml_path: path }).eq("id", r.id);
    written++;
    console.log(`wrote ${path}`);
  }

  console.log(`done. wrote=${written} unchanged=${unchanged} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
