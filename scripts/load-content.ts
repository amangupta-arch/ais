#!/usr/bin/env tsx
/**
 * Loader CLI for lesson content.
 *
 *   npm run content:load
 *
 * Reads every supabase/content/<course-slug>/NN-<lesson-slug>.yaml, validates
 * via lib/content/schema.ts, and upserts lessons + lesson_turns. Idempotent.
 *
 * Translation folders (`<course-slug>-<lang>/`) are treated as alternative
 * lesson documents for the canonical course of the same slug-prefix:
 * each translation YAML is folded into the canonical lesson row's
 * `translations.<lang>` jsonb as a full sub-document
 * (`{title, subtitle, turns}`). Lesson structures may differ freely
 * across languages — the loader does not require turn counts to match.
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
  courseSlug: string;     // canonical course slug (target of the import)
  lessonSlug: string;
  orderIndex: number;
  doc: LessonYaml;
  lang?: string;          // set for translation YAMLs; undefined for canonical EN
};

/** Translation languages we recognise for the `<canonical>-<lang>/`
 *  folder convention. Mirrors lib/types.ts LANGUAGES. */
const TRANSLATION_LANGS = [
  "hinglish", "hi", "mr", "pa", "te", "ta", "bn", "fr", "es",
] as const;

type FolderKind =
  | { kind: "canonical"; slug: string }
  | { kind: "translation"; canonicalSlug: string; lang: string };

function classifyFolder(folderName: string, knownCanonicals: Set<string>): FolderKind {
  for (const lang of TRANSLATION_LANGS) {
    const suffix = `-${lang}`;
    if (folderName.endsWith(suffix)) {
      const canonical = folderName.slice(0, -suffix.length);
      if (knownCanonicals.has(canonical)) {
        return { kind: "translation", canonicalSlug: canonical, lang };
      }
    }
  }
  return { kind: "canonical", slug: folderName };
}

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

function collectFiles(): {
  lessons: ParsedLesson[];
  translationLessons: ParsedLesson[];
  errors: FileError[];
} {
  const lessons: ParsedLesson[] = [];
  const translationLessons: ParsedLesson[] = [];
  const errors: FileError[] = [];
  const seenKeys = new Map<string, string>();

  let courseDirs: string[] = [];
  try {
    courseDirs = readdirSync(CONTENT_ROOT)
      .filter((name) => statSync(join(CONTENT_ROOT, name)).isDirectory())
      .sort();
  } catch {
    return { lessons, translationLessons, errors };
  }

  // Pass 1: identify canonical folders so we can detect translation siblings.
  // A folder is canonical unless its name is `<X>-<lang>` AND folder `<X>`
  // also exists. (`bundle-courses` is not a course folder; skip it explicitly.)
  const candidateCanonicals = new Set(courseDirs.filter((n) => n !== "bundle-courses"));
  // Note: classifyFolder uses this set as-is; if a folder's prefix doesn't
  // match a real canonical, it falls through to canonical-by-default.

  for (const folderName of courseDirs) {
    if (folderName === "bundle-courses") continue;
    const dir = join(CONTENT_ROOT, folderName);
    const files = readdirSync(dir)
      .filter((f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"))
      .sort();

    const kind = classifyFolder(folderName, candidateCanonicals);

    for (const file of files) {
      const rel = `${folderName}/${file}`;
      const match = file.match(FILENAME_RE);
      if (!match) {
        errors.push({ path: rel, message: `filename must match NN-<slug>.yaml` });
        continue;
      }
      const orderIndex = Number.parseInt(match[1]!, 10);
      const lessonSlug = match[2]!;

      const key = `${folderName}/${lessonSlug}`;
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

      const parsedLesson: ParsedLesson = {
        path: rel,
        courseSlug: kind.kind === "canonical" ? kind.slug : kind.canonicalSlug,
        lessonSlug,
        orderIndex,
        doc: parsed.data,
        ...(kind.kind === "translation" ? { lang: kind.lang } : {}),
      };
      if (kind.kind === "canonical") {
        lessons.push(parsedLesson);
      } else {
        translationLessons.push(parsedLesson);
      }
    }
  }

  return { lessons, translationLessons, errors };
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  const { lessons, translationLessons, errors: fileErrors } = collectFiles();

  if (lessons.length === 0 && translationLessons.length === 0 && fileErrors.length === 0) {
    console.log(`No lesson files under ${CONTENT_ROOT}.`);
    return;
  }

  if (dryRun) {
    let turns = 0;
    for (const lesson of [...lessons, ...translationLessons]) {
      const tag = lesson.lang ? ` [translation: ${lesson.lang}]` : "";
      console.log(`${lesson.path}${tag}`);
      console.log(`  course=${lesson.courseSlug} slug=${lesson.lessonSlug} order=${lesson.orderIndex} title="${lesson.doc.title}"`);
      lesson.doc.turns.forEach((turn, idx) => {
        const xp = turnXpReward(turn);
        console.log(`    ${(idx + 1).toString().padStart(2, " ")}. ${turn.type.padEnd(16)} xp=${xp}`);
      });
      turns += lesson.doc.turns.length;
    }
    console.log("");
    const total = lessons.length + translationLessons.length;
    console.log(
      `${lessons.length} canonical · ${translationLessons.length} translation · ${total} files · ${turns} turns · ${fileErrors.length} errors (dry run)`,
    );
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
  let translationsLoaded = 0;

  // Cache course lookups.
  const courseIdBySlug = new Map<string, string>();
  // (lessonId by `${courseSlug}/${lessonSlug}`) — populated by canonical pass,
  // reused by translation pass to find the row to merge into.
  const lessonIdByKey = new Map<string, string>();

  // ---------------- pass 1: canonical lessons ----------------
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

      // Upsert lesson row. Canonical pass sets only translations.en;
      // the translation pass below deep-merges other languages on top.
      // Read existing translations first so we don't clobber languages
      // already loaded from previous runs.
      const { data: existing } = await supabase
        .from("lessons")
        .select("translations")
        .eq("course_id", courseId)
        .eq("slug", lesson.lessonSlug)
        .maybeSingle();
      const existingTrans =
        (existing?.translations as Record<string, unknown> | null) ?? {};

      const translations: Record<string, unknown> = {
        ...existingTrans,
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

      lessonIdByKey.set(
        `${lesson.courseSlug}/${lesson.lessonSlug}`,
        lessonRow.id as string,
      );

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

  // ---------------- pass 2: translation overlays ----------------
  // For each translation YAML, fold its full content (title, subtitle,
  // turns) into the canonical lesson row's `translations[<lang>]`.
  // The renderer reads from there for non-EN users (see the lesson page).
  for (const t of translationLessons) {
    if (!t.lang) continue;
    const key = `${t.courseSlug}/${t.lessonSlug}`;
    try {
      let lessonId = lessonIdByKey.get(key);
      if (!lessonId) {
        // Not loaded in this run; look it up. Translation may exist
        // for a lesson that didn't change in the canonical folder.
        let courseId = courseIdBySlug.get(t.courseSlug);
        if (!courseId) {
          const { data: cdata, error: cerr } = await supabase
            .from("courses")
            .select("id")
            .eq("slug", t.courseSlug)
            .maybeSingle();
          if (cerr) throw new Error(`course lookup failed: ${cerr.message}`);
          if (!cdata) throw new Error(`unknown canonical course "${t.courseSlug}"`);
          courseId = cdata.id as string;
          courseIdBySlug.set(t.courseSlug, courseId);
        }
        const { data: ldata, error: lerr } = await supabase
          .from("lessons")
          .select("id")
          .eq("course_id", courseId)
          .eq("slug", t.lessonSlug)
          .maybeSingle();
        if (lerr) throw new Error(`lesson lookup failed: ${lerr.message}`);
        if (!ldata)
          throw new Error(
            `no canonical lesson "${t.courseSlug}/${t.lessonSlug}" — author the EN version first`,
          );
        lessonId = ldata.id as string;
        lessonIdByKey.set(key, lessonId);
      }

      // Build the translation document. We store turns as a jsonb array
      // mirroring the LessonTurn shape used at render time.
      const translatedTurns = t.doc.turns.map((turn, idx) => ({
        order_index: idx + 1,
        turn_type: turn.type,
        content: turnContent(turn),
        xp_reward: turnXpReward(turn),
      }));
      const langDoc: Record<string, unknown> = {
        title: t.doc.title,
        ...(t.doc.subtitle ? { subtitle: t.doc.subtitle } : {}),
        turns: translatedTurns,
      };

      // Deep-merge into translations jsonb. Read-modify-write so we
      // don't clobber other languages.
      const { data: cur, error: curErr } = await supabase
        .from("lessons")
        .select("translations")
        .eq("id", lessonId)
        .single();
      if (curErr) throw new Error(`read translations: ${curErr.message}`);
      const merged = {
        ...((cur?.translations as Record<string, unknown> | null) ?? {}),
        [t.lang]: langDoc,
      };
      const { error: updErr } = await supabase
        .from("lessons")
        .update({ translations: merged })
        .eq("id", lessonId);
      if (updErr) throw new Error(`update translations: ${updErr.message}`);

      console.log(`${t.path} [${t.lang}]\n  ✓ folded ${translatedTurns.length} turns into translations.${t.lang}`);
      translationsLoaded += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      runErrors.push({ path: `${t.path} [${t.lang}]`, message });
      console.error(`${t.path} [${t.lang}]\n  ✗ ${message}`);
    }
  }

  console.log("");
  console.log(
    `${lessonsLoaded} canonical lesson${lessonsLoaded === 1 ? "" : "s"} · ` +
    `${turnsLoaded} canonical turn${turnsLoaded === 1 ? "" : "s"} · ` +
    `${translationsLoaded} translation${translationsLoaded === 1 ? "" : "s"} · ` +
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
