#!/usr/bin/env tsx
/**
 * Generator CLI for lesson content.
 *
 *   npm run content:generate -- --course=nlp-basics --slug=embeddings
 *   npm run content:generate -- --course=nlp-basics --all
 *
 * Reads supabase/content/<course>/_outline.yaml, calls Claude with the
 * schema + depth standard + voice guide + exemplar baked into the system
 * prompt, validates the output via lessonSchema, retries with feedback on
 * schema or depth-floor failures, then writes NN-<slug>.yaml.
 *
 * Hard cap: 5 LLM attempts per lesson. Cost-aware on purpose.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
import Anthropic from "@anthropic-ai/sdk";

import { lessonSchema, type LessonYaml } from "../lib/content/schema";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT_ROOT = join(ROOT, "supabase/content");
const SCHEMA_PATH = join(ROOT, "lib/content/schema.ts");
const AUTHORING_PATH = join(CONTENT_ROOT, "AUTHORING.md");
const EXEMPLAR_PATH = join(CONTENT_ROOT, "_exemplar.yaml");

const MODEL = "claude-opus-4-7";
const MAX_ATTEMPTS = 5;
const MAX_TOKENS = 8192;

const DEPTH_FLOOR = {
  totalTurns: 14,
  tutorTurns: 8,
  tutorChars: 4000,
  distinctTypes: 5,
  estimatedMinutes: 12,
};

type Outline = {
  course: {
    slug: string;
    title: string;
    audience: string;
    voice: string;
    callback_policy?: string;
  };
  lessons: Array<{
    prefix: string;
    slug: string;
    target_minutes: number;
    target_xp: number;
    objectives: string[];
    key_concepts: string[];
    misconceptions_to_demolish?: string[];
    prerequisites?: string[];
  }>;
};

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]!]) {
        let val = m[2]!.trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[m[1]!] = val;
      }
    }
  } catch {
    // optional
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY. Add it to .env.local or export it.");
    process.exit(1);
  }
}

function parseArgs() {
  const args = new Map<string, string | true>();
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args.set(m[1]!, m[2] ?? true);
  }
  const course = args.get("course");
  const slug = args.get("slug");
  const all = args.get("all") === true;
  if (typeof course !== "string") {
    console.error("Usage: --course=<slug> ( --slug=<lesson-slug> | --all )");
    process.exit(1);
  }
  if (!all && typeof slug !== "string") {
    console.error("Pass --slug=<lesson-slug> or --all.");
    process.exit(1);
  }
  return { course, slug: typeof slug === "string" ? slug : null, all };
}

function loadOutline(courseSlug: string): Outline {
  const path = join(CONTENT_ROOT, courseSlug, "_outline.yaml");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.error(`No _outline.yaml at ${path}`);
    process.exit(1);
  }
  const doc = yaml.load(raw) as Outline;
  if (!doc?.course?.slug || !Array.isArray(doc.lessons)) {
    console.error(`Outline at ${path} is malformed (missing course.slug or lessons[]).`);
    process.exit(1);
  }
  if (doc.course.slug !== courseSlug) {
    console.error(`Outline course.slug (${doc.course.slug}) doesn't match directory (${courseSlug}).`);
    process.exit(1);
  }
  return doc;
}

function buildSystemPrompt(outline: Outline): string {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const authoring = readFileSync(AUTHORING_PATH, "utf8");
  const exemplar = readFileSync(EXEMPLAR_PATH, "utf8");

  return `You are a senior curriculum designer writing one lesson at a time for a learning app.

Your output is **always a single YAML document** that represents one lesson. No prose before, no prose after, no markdown code fences. Just the YAML.

# Course context

- Slug: ${outline.course.slug}
- Title: ${outline.course.title}
- Audience: ${outline.course.audience.trim()}
- Voice: ${outline.course.voice.trim()}
${outline.course.callback_policy ? `- Callback policy: ${outline.course.callback_policy.trim()}` : ""}

# Authoring guide (rules you must follow)

The full authoring guide is below. Pay special attention to the **Depth floor**, **Pacing rule**, **Mechanic mix rule**, and **Voice** sections.

\`\`\`markdown
${authoring}
\`\`\`

# Schema you must produce (Zod source)

Your YAML must validate against \`lessonSchema\` from this file:

\`\`\`ts
${schema}
\`\`\`

# Reference exemplar — STRUCTURE/DEPTH/VOICE only

Below is one hand-tuned reference lesson. It is on a **different topic** from the lesson you'll write. **Copy its depth, pacing, and voice. Do NOT copy its content.**

\`\`\`yaml
${exemplar}
\`\`\`

# Critical rules

1. Output exactly one YAML document. No \`\`\`yaml fences, no commentary.
2. Use \`type: tutor_message\` (snake_case), never \`type: tutorMessage\`.
3. Use \`*italic*\` for emphasis. Never \`**bold**\`. The renderer ignores bold but italic carries weight.
4. Em-dash without spaces: \`learning—not memorising\`.
5. Digits for counts: \`3 examples\`, not \`three examples\`.
6. No "leverage", "empower", "elevate", "unlock your potential". They get auto-rejected.
7. Tutor message text uses \`|\` block scalar so newlines are preserved.
8. Every \`mcq\` option must have a \`rationale\`.
9. \`fill_in_the_blank\` template uses \`{{id}}\` tokens — id must match \`answers[].id\`.
10. \`tap_to_match\`: \`left.length === right.length === pairs.length\`.
11. \`drag_to_reorder\`: \`correct_order\` lists every \`item.id\` exactly once.
12. Every lesson ends with a \`checkpoint\`.
13. Do NOT use \`media\` turns — there are no hosted assets to point to.
14. Use at least 5 distinct turn types. Lean into \`ai_conversation\`, \`exercise\`, \`free_text\` — they are underused in this course.
15. No interactive turn (mcq/match/drag/fill/free_text) before turn 5 unless it's a \`reflection\`.
16. Hit the depth floor: ≥14 turns, ≥8 tutor_message turns, ≥4000 chars total tutor text, ≥5 distinct types, estimated_minutes ≥12.
`;
}

function buildLessonPrompt(
  outline: Outline,
  lesson: Outline["lessons"][number],
  index: number,
): string {
  const prereqList = (lesson.prerequisites ?? []).filter(Boolean);
  const prereqs = prereqList.length
    ? `Prerequisite lessons (already taught — feel free to call back):\n${prereqList.map((p) => `  - ${p}`).join("\n")}`
    : "This is the first lesson in the course — no prerequisites.";

  const positionNote = index === 0
    ? "This is lesson 01. Open with a hook that lands fast."
    : `This is lesson ${lesson.prefix} of ${outline.lessons.length}. Open with a callback to a prior lesson when natural.`;

  const misconceptions = (lesson.misconceptions_to_demolish ?? [])
    .map((m) => `  - ${m}`).join("\n") || "  (none specified — use your judgement)";

  return `Write one lesson now.

# Lesson scope

- Slug: ${lesson.slug}
- Order in course: ${lesson.prefix}
- Target estimated_minutes: ${lesson.target_minutes}
- Target xp_reward (top-level): ${lesson.target_xp}

# Objectives (the learner must walk away able to do these)

${lesson.objectives.map((o) => `  - ${o}`).join("\n")}

# Key concepts to teach

${lesson.key_concepts.map((c) => `  - ${c}`).join("\n")}

# Misconceptions to demolish (name them, then correct them)

${misconceptions}

# ${prereqs}

${positionNote}

# Reminder of the depth floor

- ≥14 turns total (target 16-20)
- ≥8 tutor_message turns
- ≥4000 chars total tutor_message text (target 5000-7000)
- ≥5 distinct turn types
- estimated_minutes ≥12 (use the target above)
- ≥2 worked examples per major concept
- ≥1 misconception explicitly named and corrected

Output the YAML lesson now. Nothing else.`;
}

function stripFences(text: string): string {
  let t = text.trim();
  // Strip an opening fence like ```yaml or ```
  t = t.replace(/^```[a-z]*\n/i, "");
  // Strip a closing fence
  t = t.replace(/\n```$/i, "");
  return t.trim();
}

type DepthReport = {
  totalTurns: number;
  tutorTurns: number;
  tutorChars: number;
  distinctTypes: number;
  earlyInteractive: number; // count of disallowed early interactives
  estimatedMinutes: number;
  failures: string[];
};

function measureDepth(doc: LessonYaml): DepthReport {
  const totalTurns = doc.turns.length;
  const tutorTurns = doc.turns.filter((t) => t.type === "tutor_message").length;
  const tutorChars = doc.turns
    .filter((t) => t.type === "tutor_message")
    .reduce((acc, t) => acc + (t as { text: string }).text.length, 0);
  const types = new Set(doc.turns.map((t) => t.type));
  const distinctTypes = types.size;
  const interactiveTypes = new Set([
    "mcq", "tap_to_match", "drag_to_reorder", "fill_in_the_blank", "free_text",
  ]);
  const earlyInteractive = doc.turns
    .slice(0, 4) // turns 1-4
    .filter((t) => interactiveTypes.has(t.type as string)).length;

  const failures: string[] = [];
  if (totalTurns < DEPTH_FLOOR.totalTurns) {
    failures.push(`Total turns is ${totalTurns}, must be ≥ ${DEPTH_FLOOR.totalTurns}.`);
  }
  if (tutorTurns < DEPTH_FLOOR.tutorTurns) {
    failures.push(`tutor_message count is ${tutorTurns}, must be ≥ ${DEPTH_FLOOR.tutorTurns}.`);
  }
  if (tutorChars < DEPTH_FLOOR.tutorChars) {
    failures.push(`Total tutor_message text is ${tutorChars} chars, must be ≥ ${DEPTH_FLOOR.tutorChars}.`);
  }
  if (distinctTypes < DEPTH_FLOOR.distinctTypes) {
    failures.push(`Used only ${distinctTypes} distinct turn types, must be ≥ ${DEPTH_FLOOR.distinctTypes}. (Try ai_conversation, exercise, free_text.)`);
  }
  if (doc.estimated_minutes < DEPTH_FLOOR.estimatedMinutes) {
    failures.push(`estimated_minutes is ${doc.estimated_minutes}, must be ≥ ${DEPTH_FLOOR.estimatedMinutes}.`);
  }
  if (earlyInteractive > 0) {
    failures.push(`${earlyInteractive} interactive turn(s) appear in turns 1-4. Move them to turn 5+ — let the explanation breathe first.`);
  }

  return {
    totalTurns,
    tutorTurns,
    tutorChars,
    distinctTypes,
    earlyInteractive,
    estimatedMinutes: doc.estimated_minutes,
    failures,
  };
}

async function generateOne(
  client: Anthropic,
  outline: Outline,
  lesson: Outline["lessons"][number],
  lessonIndex: number,
): Promise<{ doc: LessonYaml; depth: DepthReport; attempts: number }> {
  const system = buildSystemPrompt(outline);
  const userOpening = buildLessonPrompt(outline, lesson, lessonIndex);

  type Msg = { role: "user" | "assistant"; content: string };
  const messages: Msg[] = [{ role: "user", content: userOpening }];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });

    const block = res.content.find((b) => b.type === "text");
    const raw = block && "text" in block ? (block.text as string) : "";
    const cleaned = stripFences(raw);

    let parsedDoc: unknown;
    try {
      parsedDoc = yaml.load(cleaned);
    } catch (e) {
      const fb = `Your output failed YAML parse: ${String(e)}\n\nReturn the YAML again. No prose, no fences, just one YAML document.`;
      messages.push({ role: "assistant", content: cleaned });
      messages.push({ role: "user", content: fb });
      console.log(`  attempt ${attempt} → YAML parse error, retrying`);
      continue;
    }

    const validated = lessonSchema.safeParse(parsedDoc);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `  ${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("\n");
      const fb = `Your YAML failed schema validation:\n${issues}\n\nFix every issue and return the YAML again. No prose, no fences.`;
      messages.push({ role: "assistant", content: cleaned });
      messages.push({ role: "user", content: fb });
      console.log(`  attempt ${attempt} → schema invalid, retrying`);
      continue;
    }

    const depth = measureDepth(validated.data);
    if (depth.failures.length > 0) {
      const fb = `Your YAML is schema-valid but does not hit the depth floor:\n${depth.failures.map((f) => `  - ${f}`).join("\n")}\n\nExpand the lesson to fix every issue, while keeping the same content quality. Return the full YAML again. No prose, no fences.`;
      messages.push({ role: "assistant", content: cleaned });
      messages.push({ role: "user", content: fb });
      console.log(`  attempt ${attempt} → depth floor missed (${depth.failures.length} issue${depth.failures.length === 1 ? "" : "s"}), retrying`);
      continue;
    }

    return { doc: validated.data, depth, attempts: attempt };
  }

  throw new Error(`Gave up after ${MAX_ATTEMPTS} attempts.`);
}

function writeLesson(
  courseSlug: string,
  prefix: string,
  lessonSlug: string,
  doc: LessonYaml,
): string {
  const filename = `${prefix}-${lessonSlug}.yaml`;
  const path = join(CONTENT_ROOT, courseSlug, filename);
  // Re-serialise via js-yaml for canonical formatting (block scalars, no
  // funny quoting). lineWidth: -1 keeps long lines intact.
  const out = yaml.dump(doc, { lineWidth: -1, noRefs: true, quotingType: '"' });
  writeFileSync(path, out, "utf8");
  return path;
}

async function main() {
  loadEnv();
  const args = parseArgs();
  const outline = loadOutline(args.course);

  const targets = args.all
    ? outline.lessons
    : outline.lessons.filter((l) => l.slug === args.slug);

  if (targets.length === 0) {
    console.error(`No lesson with slug "${args.slug}" in ${args.course}.`);
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  let ok = 0;
  let failed = 0;
  for (const lesson of targets) {
    const idx = outline.lessons.indexOf(lesson);
    console.log(`\n[${args.course}/${lesson.prefix}-${lesson.slug}] generating…`);
    try {
      const { doc, depth, attempts } = await generateOne(client, outline, lesson, idx);
      const path = writeLesson(args.course, lesson.prefix, lesson.slug, doc);
      console.log(`  ✓ ${path}`);
      console.log(`    turns=${depth.totalTurns} tutor=${depth.tutorTurns} chars=${depth.tutorChars} types=${depth.distinctTypes} mins=${depth.estimatedMinutes} attempts=${attempts}`);
      ok += 1;
    } catch (e) {
      console.error(`  ✗ ${(e as Error).message}`);
      failed += 1;
    }
  }

  console.log(`\nDone. ${ok} ok, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
