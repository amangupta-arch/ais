#!/usr/bin/env tsx
/**
 * Emits idempotent SQL (one DO block per lesson) that replicates what
 * scripts/load-content.ts writes — lessons (en + translation overlays) +
 * lesson_turns — but as SQL text instead of a live Supabase client, so it
 * can be applied through the Supabase MCP `execute_sql` tool (no service
 * key in this environment).
 *
 *   npx tsx scripts/emit-lesson-sql.ts <canonical-course-slug> [more...] > /tmp/x.sql
 *
 * Only the canonical course folders named on the CLI (and their
 * `<slug>-<lang>/` translation siblings) are emitted. Uses the exact
 * turnContent / turnXpReward transforms from lib/content/schema.ts.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

import {
  lessonSchema,
  turnContent,
  turnXpReward,
  type LessonYaml,
} from "../lib/content/schema";

const TRANSLATION_LANGS = [
  "hinglish", "hi", "mr", "pa", "te", "ta", "bn", "fr", "es",
] as const;

const CONTENT_ROOT = fileURLToPath(new URL("../supabase/content", import.meta.url));
const FILENAME_RE = /^(\d{2,})-([a-z0-9][a-z0-9-]*)\.ya?ml$/;

function readLangMarker(dir: string): string | null {
  for (const name of ["_lang.yaml", "_lang.yml"]) {
    try {
      const raw = readFileSync(join(dir, name), "utf8");
      if (raw.trim() === "") return "";
      const parsed = yaml.load(raw) as unknown;
      if (parsed && typeof parsed === "object" && "lang" in parsed) {
        const v = (parsed as { lang: unknown }).lang;
        return typeof v === "string" ? v : "";
      }
      return "";
    } catch { /* try next */ }
  }
  return null;
}

type Doc = { courseSlug: string; lessonSlug: string; orderIndex: number; doc: LessonYaml; lang?: string };

function collect(allow: Set<string>): { canonical: Doc[]; translations: Doc[] } {
  const canonical: Doc[] = [];
  const translations: Doc[] = [];
  const dirs = readdirSync(CONTENT_ROOT).filter((n) => {
    try { return statSync(join(CONTENT_ROOT, n)).isDirectory(); } catch { return false; }
  });
  const known = new Set(dirs.filter((n) => n !== "bundle-courses"));

  for (const folder of dirs) {
    if (folder === "bundle-courses") continue;
    const marker = readLangMarker(join(CONTENT_ROOT, folder));
    let kind: { canonical: true; slug: string } | { canonical: false; slug: string; lang: string };
    if (marker === null) {
      kind = { canonical: true, slug: folder };
    } else {
      const explicit = marker.trim();
      let resolved: { slug: string; lang: string } | null = null;
      for (const lang of TRANSLATION_LANGS) {
        const sfx = `-${lang}`;
        if (folder.endsWith(sfx)) {
          const base = folder.slice(0, -sfx.length);
          if (known.has(base)) { resolved = { slug: base, lang: explicit || lang }; break; }
        }
      }
      kind = resolved ? { canonical: false, ...resolved } : { canonical: true, slug: folder };
    }

    const targetCourse = kind.slug;
    if (!allow.has(targetCourse)) continue;

    const files = readdirSync(join(CONTENT_ROOT, folder))
      .filter((f) => (f.endsWith(".yaml") || f.endsWith(".yml")) && !f.startsWith("_"))
      .sort();
    for (const file of files) {
      const m = file.match(FILENAME_RE);
      if (!m) { console.error(`skip ${folder}/${file}: bad filename`); continue; }
      const orderIndex = Number.parseInt(m[1]!, 10);
      const lessonSlug = m[2]!;
      const raw = yaml.load(readFileSync(join(CONTENT_ROOT, folder, file), "utf8"));
      const parsed = lessonSchema.safeParse(raw);
      if (!parsed.success) {
        console.error(`VALIDATION FAILED ${folder}/${file}:\n${parsed.error.issues.map((i) => "  " + (i.path.join(".") || "<root>") + ": " + i.message).join("\n")}`);
        process.exit(1);
      }
      const rec: Doc = { courseSlug: targetCourse, lessonSlug, orderIndex, doc: parsed.data };
      if (kind.canonical) canonical.push(rec);
      else translations.push({ ...rec, lang: kind.lang });
    }
  }
  return { canonical, translations };
}

const DOLLAR = "$lj$"; // dollar-quote tag for embedded JSON

function jq(obj: unknown): string {
  const s = JSON.stringify(obj);
  if (s.includes(DOLLAR)) throw new Error("JSON contains dollar-quote tag collision");
  return `${DOLLAR}${s}${DOLLAR}::jsonb`;
}

function main() {
  const allow = new Set(process.argv.slice(2));
  if (allow.size === 0) { console.error("usage: emit-lesson-sql.ts <course-slug>..."); process.exit(1); }

  const { canonical, translations } = collect(allow);
  // index translations by course/lesson
  const transByKey = new Map<string, Doc>();
  for (const t of translations) transByKey.set(`${t.courseSlug}/${t.lessonSlug}`, t);

  const out: string[] = [];
  // Single DO block so the whole script is one EXECUTE-able statement
  // (lets Supabase pull it from a raw URL via pg_net and run it server-side).
  out.push(`DO $deploy$\nDECLARE v_lesson uuid;\nBEGIN`);
  for (const les of canonical) {
    const key = `${les.courseSlug}/${les.lessonSlug}`;
    const t = transByKey.get(key);
    const translationsObj: Record<string, unknown> = {
      en: {
        title: les.doc.title,
        ...(les.doc.subtitle ? { subtitle: les.doc.subtitle } : {}),
      },
    };
    if (t) {
      translationsObj[t.lang!] = {
        title: t.doc.title,
        ...(t.doc.subtitle ? { subtitle: t.doc.subtitle } : {}),
        turns: t.doc.turns.map((turn, idx) => ({
          order_index: idx + 1,
          turn_type: turn.type,
          content: turnContent(turn),
          xp_reward: turnXpReward(turn),
        })),
      };
    }

    const turnValues = les.doc.turns.map((turn, idx) =>
      `    (v_lesson, ${idx + 1}, '${turn.type}', ${jq(turnContent(turn))}, ${turnXpReward(turn)}, true)`
    ).join(",\n");

    out.push(`  -- ${les.courseSlug}/${les.lessonSlug}
  INSERT INTO lessons (course_id, slug, translations, order_index, estimated_minutes, xp_reward, format, is_published)
  VALUES ((SELECT id FROM courses WHERE slug = '${les.courseSlug}'), '${les.lessonSlug}', ${jq(translationsObj)}, ${les.orderIndex}, ${les.doc.estimated_minutes}, ${les.doc.xp_reward}, 'ai_chat', true)
  ON CONFLICT (course_id, slug) DO UPDATE SET
    translations = excluded.translations,
    order_index = excluded.order_index,
    estimated_minutes = excluded.estimated_minutes,
    xp_reward = excluded.xp_reward,
    format = 'ai_chat',
    is_published = true
  RETURNING id INTO v_lesson;
  DELETE FROM lesson_turns WHERE lesson_id = v_lesson;
  INSERT INTO lesson_turns (lesson_id, order_index, turn_type, content, xp_reward, is_required) VALUES
${turnValues};`);
  }
  // recompute lesson_count + purge any zero-turn orphan stubs for these courses
  const courseList = [...allow].map((s) => `'${s}'`).join(",");
  out.push(`  DELETE FROM lessons l USING courses c
  WHERE l.course_id = c.id AND c.slug IN (${courseList})
    AND NOT EXISTS (SELECT 1 FROM lesson_turns t WHERE t.lesson_id = l.id);
  UPDATE courses c SET lesson_count = (SELECT count(*) FROM lessons l WHERE l.course_id = c.id)
  WHERE c.slug IN (${courseList});
END $deploy$;`);

  console.log(out.join("\n\n"));
  console.error(`emitted ${canonical.length} canonical lessons, ${translations.length} translation overlays`);
}

main();
