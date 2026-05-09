/**
 * Wraps the Anthropic SDK to generate one lesson YAML at a time using
 * docs/lesson-yaml-knowledge.md as the system prompt. Validates the
 * output via lessonSchema and retries up to MAX_ATTEMPTS with feedback
 * on validation failures.
 *
 * Server-only — never bundle into the browser.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import yaml from "js-yaml";

import { lessonSchema } from "@/lib/content/schema";

import type { LessonEntry } from "./catalog";

export const GENERATOR_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;
const MAX_ATTEMPTS = 3;

const KNOWLEDGE_PATH = join(process.cwd(), "docs/lesson-yaml-knowledge.md");

let cachedKnowledge: string | null = null;
function loadKnowledge(): string {
  if (cachedKnowledge) return cachedKnowledge;
  cachedKnowledge = readFileSync(KNOWLEDGE_PATH, "utf8");
  return cachedKnowledge;
}

export type GenerateInput = {
  entry: LessonEntry;
  language: string;
};

export type GenerateOk = {
  ok: true;
  yamlText: string;
  attempts: number;
};

export type GenerateErr = {
  ok: false;
  message: string;
  attempts: number;
};

export type GenerateResult = GenerateOk | GenerateErr;

function buildUserPrompt(entry: LessonEntry, language: string): string {
  const langLabel = language === "en" ? "English (canonical)" : language;
  return [
    `Generate the lesson YAML for the lesson below. Output ONLY the YAML — no markdown fences, no preamble.`,
    ``,
    `LANGUAGE: ${langLabel}`,
    `BUNDLE: ${entry.bundleSlug}`,
    `COURSE: ${entry.courseTitle}`,
    `COURSE OUTCOME: ${entry.courseOutcome}`,
    ``,
    `LESSON ${entry.lessonIndex} of ${entry.courseLessonCount}: "${entry.lessonTitle}"`,
    ``,
    `SIBLING LESSONS in this course (in order, for context — don't duplicate their content):`,
    ...entry.siblingTitles.map((t, i) => `  ${i + 1}. ${t}${i + 1 === entry.lessonIndex ? "  ← this one" : ""}`),
    ``,
    `Strictly follow every rule in the system prompt's checklist.`,
    `Aim for 14–18 turns. Last turn MUST be a checkpoint.`,
    language === "en"
      ? ``
      : `This is the ${langLabel} translation. Keep the same lesson structure as the canonical EN version would have, but translate ALL user-visible strings (title, subtitle, tutor text, prompts, options, rationales, summaries). Do NOT translate ids, persona names, tool names, URLs, or markup contents.`,
  ].join("\n");
}

function extractYaml(text: string): string {
  // Strip markdown code fences if present.
  const fenceMatch = text.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();
  return text.trim();
}

/** One attempt at generating a valid YAML. Returns the raw text on
 *  success (validated), or a structured error describing what failed. */
async function attemptOnce(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  feedback: string | null,
): Promise<{ yamlText: string } | { error: string }> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userPrompt },
  ];
  if (feedback) {
    messages.push({
      role: "assistant",
      content: "Acknowledged. I will produce a corrected YAML.",
    });
    messages.push({
      role: "user",
      content: `Your previous attempt failed validation. Fix these issues and re-emit the FULL YAML:\n\n${feedback}`,
    });
  }

  const res = await client.messages.create({
    model: GENERATOR_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages,
  });

  const text = res.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  if (!text) return { error: "Empty response from model." };

  const candidate = extractYaml(text);

  let parsed: unknown;
  try {
    parsed = yaml.load(candidate);
  } catch (e) {
    return { error: `YAML parse error: ${String(e)}` };
  }

  const validation = lessonSchema.safeParse(parsed);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    return { error: `Schema validation failed:\n${issues}` };
  }

  return { yamlText: candidate };
}

export async function generateLessonYaml(input: GenerateInput): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: "ANTHROPIC_API_KEY is not set on the server.",
      attempts: 0,
    };
  }

  const client = new Anthropic({ apiKey });
  const systemPrompt = loadKnowledge();
  const userPrompt = buildUserPrompt(input.entry, input.language);

  let feedback: string | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await attemptOnce(client, systemPrompt, userPrompt, feedback);
    if ("yamlText" in result) {
      return { ok: true, yamlText: result.yamlText, attempts: attempt };
    }
    feedback = result.error;
  }

  return {
    ok: false,
    message: `Failed after ${MAX_ATTEMPTS} attempts. Last error:\n${feedback}`,
    attempts: MAX_ATTEMPTS,
  };
}
