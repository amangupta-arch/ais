#!/usr/bin/env tsx
/**
 * Loader CLI for lesson content.
 *
 *   npm run content:load
 *
 * Reads every supabase/content/<course-slug>/NN-<lesson-slug>.yaml, validates
 * via lib/content/schema.ts, and upserts lessons + lesson_turns. Idempotent.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import { createClient } from "@supabase/supabase-js";

import {
  lessonSchema,
  turnContent,
  turnXpReward,
  type LessonYaml,
} from "../lib/content/schema";

type ParsedLesson = {
  path: string;           // relative path for error messages
  courseSlug: string;
  lessonSlug: string;
  orderIndex: number;
  doc: LessonYaml;
};

type FileError = { path: string; message: string };

const CONTENT_ROOT = fileURLToPath(new URL("../supabase/content", import.meta.url));
const FILENAME_RE = /^(\d{2,})-([a-z0-9][a-z0-9-]*)\.ya?ml$/;

function loadEnv(): { url: string; serviceKey: string } {
  // Next reads .env.local automatically; scripts don't, so do it manually.
  try {
    const raw = readFileSync(fileURLToPath(new URL("../.env.local", import.meta.url)), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]!]) {
        let val = m[2]!.trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[m[1]!] = val;
      }
    }
  } catch {
    // .env.local optional — env may be set externally
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    console.error("Add them to .env.local or export them in your shell.");
    process.exit(1);
  }
  return { url, serviceKey };
}

function collectFiles(): { lessons: ParsedLesson[]; errors: FileError[] } {
  const lessons: ParsedLesson[] = [];
  const errors: FileError[] = [];
  const seenKeys = new Map<string, string>(); // `${course}/${slug}` → first path using it

  let courseDirs: string[] = [];
  try {
    courseDirs = readdirSync(CONTENT_ROOT)
      .filter((name) => statSync(join(CONTENT_ROOT, name)).isDirectory())
      .sort();
  } catch {
    return { lessons, errors };
  }

  for (const courseSlug of courseDirs) {
    const dir = join(CONTENT_ROOT, courseSlug);
    const files = readdirSync(dir)
      .filter((f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"))
      .sort();
    for (const file of files) {
      const rel = `${courseSlug}/${file}`;
      const match = file.match(FILENAME_RE);
      if (!match) {
        errors.push({ path: rel, message: `filename must match NN-<slug>.yaml` });
        continue;
      }
      const orderIndex = Number.parseInt(match[1]!, 10);
      const lessonSlug = match[2]!;

      const key = `${courseSlug}/${lessonSlug}`;
      const firstSeen = seenKeys.get(key);
      if (firstSeen) {
        errors.push({
          path: rel,
          message: `duplicate lesson slug "${lessonSlug}" — first used by ${firstSeen}`,
        });
        continue;
      }
      seenKeys.set(key, rel);

      let rawDoc: unknown;
      try {
        rawDoc = yaml.load(readFileSync(join(dir, file), "utf8"));
      } catch (e) {
        errors.push({ path: rel, message: `YAML parse error: ${String(e)}` });
        continue;
      }

      const parsed = lessonSchema.safeParse(rawDoc);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("\n");
        errors.push({ path: rel, message: `validation failed:\n${issues}` });
        continue;
      }

      lessons.push({
        path: rel,
        courseSlug,
        lessonSlug,
        orderIndex,
        doc: parsed.data,
      });
    }
  }

  return { lessons, errors };
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  const { lessons, errors: fileErrors } = collectFiles();

  if (lessons.length === 0 && fileErrors.length === 0) {
    console.log(`No lesson files under ${CONTENT_ROOT}.`);
    return;
  }

  if (dryRun) {
    let turns = 0;
    for (const lesson of lessons) {
      console.log(`${lesson.path}`);
      console.log(`  course=${lesson.courseSlug} slug=${lesson.lessonSlug} order=${lesson.orderIndex} title="${lesson.doc.title}"`);
      lesson.doc.turns.forEach((turn, idx) => {
        const xp = turnXpReward(turn);
        console.log(`    ${(idx + 1).toString().padStart(2, " ")}. ${turn.type.padEnd(16)} xp=${xp}`);
      });
      turns += lesson.doc.turns.length;
    }
    console.log("");
    console.log(`${lessons.length} lesson${lessons.length === 1 ? "" : "s"} · ${turns} turns · ${fileErrors.length} errors (dry run)`);
    if (fileErrors.length > 0) {
      console.error("");
      console.error("Errors:");
      for (const e of fileErrors) console.error(`  ${e.path}: ${e.message.split("\n")[0]}`);
      process.exit(1);
    }
    return;
  }

  // Validate every file before touching the database — partial imports are worse
  // than a hard stop, because one bad file shouldn't block a sibling lesson
  // from keeping its (now stale) turns while the good one gets replaced.
  if (fileErrors.length > 0) {
    console.error(`${fileErrors.length} file${fileErrors.length === 1 ? "" : "s"} failed validation — aborting before any database writes.`);
    for (const e of fileErrors) console.error(`  ${e.path}: ${e.message.split("\n")[0]}`);
    process.exit(1);
  }

  const { url, serviceKey } = loadEnv();
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const runErrors: FileError[] = [];
  let lessonsLoaded = 0;
  let turnsLoaded = 0;

  // Cache course lookups.
  const courseIdBySlug = new Map<string, string>();

  for (const lesson of lessons) {
    try {
      let courseId = courseIdBySlug.get(lesson.courseSlug);
      if (!courseId) {
        const { data, error } = await supabase
          .from("courses")
          .select("id")
          .eq("slug", lesson.courseSlug)
          .maybeSingle();
        if (error) throw new Error(`course lookup failed: ${error.message}`);
        if (!data) throw new Error(`unknown course slug "${lesson.courseSlug}"`);
        courseId = data.id as string;
        courseIdBySlug.set(lesson.courseSlug, courseId);
      }

      // Upsert lesson row.
      // Lessons store text fields in `translations` jsonb keyed by language.
      // Authored YAML is English by convention; future translation YAMLs
      // will deep-merge into the same row (see docs).
      const translations: Record<string, { title: string; subtitle?: string }> = {
        en: {
          title: lesson.doc.title,
          ...(lesson.doc.subtitle ? { subtitle: lesson.doc.subtitle } : {}),
        },
      };

      const { data: lessonRow, error: upsertErr } = await supabase
        .from("lessons")
        .upsert(
          {
            course_id: courseId,
            slug: lesson.lessonSlug,
            translations,
            order_index: lesson.orderIndex,
            estimated_minutes: lesson.doc.estimated_minutes,
            xp_reward: lesson.doc.xp_reward,
            format: "ai_chat",
            is_published: true,
          },
          { onConflict: "course_id,slug" },
        )
        .select("id")
        .single();
      if (upsertErr || !lessonRow) throw new Error(`upsert lesson: ${upsertErr?.message}`);

      // Replace turns for this lesson.
      const { error: delErr } = await supabase
        .from("lesson_turns")
        .delete()
        .eq("lesson_id", lessonRow.id);
      if (delErr) throw new Error(`clear turns: ${delErr.message}`);

      const turnRows = lesson.doc.turns.map((turn, idx) => ({
        lesson_id: lessonRow.id as string,
        order_index: idx + 1,
        turn_type: turn.type,
        content: turnContent(turn),
        xp_reward: turnXpReward(turn),
        is_required: true,
      }));
      const { error: insErr } = await supabase.from("lesson_turns").insert(turnRows);
      if (insErr) throw new Error(`insert turns: ${insErr.message}`);

      console.log(`${lesson.path}\n  ✓ 1 lesson · ${turnRows.length} turns`);
      lessonsLoaded += 1;
      turnsLoaded += turnRows.length;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      runErrors.push({ path: lesson.path, message });
      console.error(`${lesson.path}\n  ✗ ${message}`);
    }
  }

  console.log("");
  console.log(
    `${lessonsLoaded} lesson${lessonsLoaded === 1 ? "" : "s"} · ` +
    `${turnsLoaded} turn${turnsLoaded === 1 ? "" : "s"} · ` +
    `${runErrors.length} error${runErrors.length === 1 ? "" : "s"}`,
  );

  if (runErrors.length > 0) {
    console.error("");
    console.error("Errors:");
    for (const e of runErrors) console.error(`  ${e.path}: ${e.message.split("\n")[0]}`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
