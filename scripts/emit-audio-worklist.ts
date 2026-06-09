#!/usr/bin/env tsx
/**
 * Emits a cowork-facing narration worklist + a machine-readable manifest
 * for a chapter's lessons, in EN + Hinglish. The spoken text is pulled
 * through the *exact* same extractor + markdown-stripper the real audio
 * pipeline uses (lib/audio/extract.ts), so what cowork records is exactly
 * what the app considers narration.
 *
 *   npx tsx scripts/emit-audio-worklist.ts <contentRoot> <chapterTag> <courseSlug:N>...
 *
 * Example:
 *   npx tsx scripts/emit-audio-worklist.ts supabase/content geo-ch04 \
 *     farming-systems-and-seasons:1 the-crops-of-india:2 reforms-and-the-way-forward:3
 *
 * Writes:
 *   scripts/deploy-sql/<chapterTag>-audio-worklist.md     (hand to cowork)
 *   scripts/deploy-sql/<chapterTag>-audio-manifest.json   (for wiring later)
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { lessonSchema } from "../lib/content/schema";
import { extractNarrationChunks } from "../lib/audio/extract";
import { voiceIdFor, modelFor } from "../lib/audio/voices";

const FILENAME_RE = /^(\d{2,})-([a-z0-9][a-z0-9-]*)\.ya?ml$/;

/** Final polish on top of the pipeline's stripMarkdown, covering markup
 *  the shared sanitiser doesn't (yet) handle, so cowork records clean
 *  speech:
 *    - {{blank-N}} fill tokens      → the spoken word "blank"
 *    - :red[x] / :hl[x] colour tags → inner text only
 *    - " ,  " artifacts from em-dash→", " conversion → tidy comma + space
 */
function normalizeForSpeech(text: string): string {
  let out = text.replace(/\{\{[^}]+\}\}/g, "blank");
  out = out.replace(/:[a-zA-Z]+\[([^\]]*)\]/g, "$1");
  out = out.replace(/\s+,\s+/g, ", ");
  out = out.replace(/[ \t]{2,}/g, " ");
  return out.trim();
}

type Lang = { code: "en" | "hinglish"; suffix: string; label: string };
const LANGS: Lang[] = [
  { code: "en", suffix: "", label: "English" },
  { code: "hinglish", suffix: "-hinglish", label: "Hinglish (Roman script)" },
];

type Row = {
  lang: string;
  course_slug: string;
  course_index: number;
  lesson_slug: string;
  lesson_index: number;
  turn_index: number;
  chunk_index: number;
  turn_type: string;
  text: string;
  voice_id: string;
  model: string;
  filename: string;
  storage_path: string;
};

function main() {
  const [contentRoot, chapterTag, ...courseArgs] = process.argv.slice(2);
  if (!contentRoot || !chapterTag || courseArgs.length === 0) {
    console.error("usage: emit-audio-worklist.ts <contentRoot> <chapterTag> <courseSlug:N>...");
    process.exit(1);
  }
  const courses = courseArgs.map((a) => {
    const [slug, n] = a.split(":");
    return { slug: slug!, index: Number.parseInt(n!, 10) };
  });

  const rows: Row[] = [];

  for (const course of courses) {
    for (const lang of LANGS) {
      const dir = join(contentRoot, `${course.slug}${lang.suffix}`);
      let files: string[];
      try {
        files = readdirSync(dir).filter((f) => FILENAME_RE.test(f)).sort();
      } catch {
        console.error(`! missing folder ${dir}`);
        continue;
      }
      for (const file of files) {
        const m = file.match(FILENAME_RE)!;
        const lessonIndex = Number.parseInt(m[1]!, 10);
        const lessonSlug = m[2]!;
        const doc = lessonSchema.parse(yaml.load(readFileSync(join(dir, file), "utf8")));
        const chunks = extractNarrationChunks(doc);
        for (const ch of chunks) {
          ch.text = normalizeForSpeech(ch.text);
          const turnType = doc.turns[ch.turnIndex - 1]!.type;
          const voice_id = voiceIdFor(lang.code)!;
          const model = modelFor(lang.code);
          const filename = `${chapterTag}-c${course.index}l${lessonIndex}-t${String(ch.turnIndex).padStart(2, "0")}-k${ch.chunkIndex}-${lang.code}.mp3`;
          rows.push({
            lang: lang.code,
            course_slug: course.slug,
            course_index: course.index,
            lesson_slug: lessonSlug,
            lesson_index: lessonIndex,
            turn_index: ch.turnIndex,
            chunk_index: ch.chunkIndex,
            turn_type: turnType,
            text: ch.text,
            voice_id,
            model,
            filename,
            storage_path: `cowork/${chapterTag}/${lang.code}/${filename}`,
          });
        }
      }
    }
  }

  mkdirSync("scripts/deploy-sql", { recursive: true });
  const jsonPath = `scripts/deploy-sql/${chapterTag}-audio-manifest.json`;
  writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

  const md: string[] = [];
  md.push(`# Narration worklist — ${chapterTag}`);
  md.push("");
  md.push("For cowork: generate ONE mp3 per item below, named exactly as the");
  md.push("`file:` line. Speak the quoted text and nothing else — no titles, no");
  md.push("numbers, no markdown. One calm, warm female tutor voice throughout");
  md.push("(persona “Nova”), natural pace. Save each language into its own folder.");
  md.push("");
  md.push("- **English** items: speak in clear, natural English.");
  md.push("- **Hinglish** items: speak the Roman-script Hindi-English mix exactly as");
  md.push("  written, in a natural Indian Hindi accent (do NOT translate to English).");
  md.push("");
  for (const lang of LANGS) {
    const langRows = rows.filter((r) => r.lang === lang.code);
    md.push(`\n---\n\n## ${lang.label} — ${langRows.length} clips`);
    let curCourse = "";
    let curLesson = "";
    for (const r of langRows) {
      if (r.course_slug !== curCourse) {
        curCourse = r.course_slug;
        curLesson = "";
        md.push(`\n### Course ${r.course_index}: ${r.course_slug}`);
      }
      if (r.lesson_slug !== curLesson) {
        curLesson = r.lesson_slug;
        md.push(`\n**Lesson ${r.lesson_index}: ${r.lesson_slug}**\n`);
      }
      md.push(`- file: \`${r.filename}\`  _(${r.turn_type})_`);
      md.push(`  > ${r.text.replace(/\n+/g, " ").trim()}`);
    }
  }
  const mdPath = `scripts/deploy-sql/${chapterTag}-audio-worklist.md`;
  writeFileSync(mdPath, md.join("\n") + "\n");

  const enN = rows.filter((r) => r.lang === "en").length;
  const hiN = rows.filter((r) => r.lang === "hinglish").length;
  console.error(`${chapterTag}: ${enN} EN + ${hiN} Hinglish = ${rows.length} clips`);
  console.error(`→ ${mdPath}`);
  console.error(`→ ${jsonPath}`);
}

main();
