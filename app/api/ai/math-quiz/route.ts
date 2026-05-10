// Vision-based math grader for /math-quiz-test.
//
// Takes a base64 photo of a learner's handwritten working, the
// equation they were trying to solve, the correct value of x, and
// the language they want feedback in. Asks Claude Sonnet to read
// the photo, decide if the work is correct, and explain mistakes.
//
// Returns a strict JSON shape that the client renders verbatim.
// The route is intentionally PUBLIC (matches the rest of
// /math-quiz-test) — image is forwarded to Anthropic in-memory and
// never persisted.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";

import { LANGUAGES, type PreferredLanguage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  questionId?: number;
  equation?: string;
  expectedAnswer?: number;
  language?: PreferredLanguage;
  // Either a full data URL ("data:image/jpeg;base64,...") or a bare base64 string.
  image?: string;
};

type GraderResult = {
  isCorrect: boolean;
  detectedAnswer: number | null;
  feedback: string;
  mistakes: string[];
};

const SUPPORTED_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function languageLabel(code: PreferredLanguage): string {
  return LANGUAGES.find((l) => l.code === code)?.english ?? "English";
}

// Pull "image/jpeg" + raw base64 out of either a data URL or a bare base64 blob.
// Returns null on anything we can't safely forward to Anthropic.
function parseImage(
  input: string,
): { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | null {
  const trimmed = input.trim();
  const dataUrl = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(trimmed);
  if (dataUrl) {
    const mt = dataUrl[1]?.toLowerCase();
    const data = dataUrl[2];
    if (mt && data && SUPPORTED_MEDIA_TYPES.has(mt)) {
      return { mediaType: mt as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data };
    }
    return null;
  }
  // Bare base64 — assume jpeg (camera default). Sniff the magic-byte prefix
  // in the first few base64 chars to do a slightly better default for png.
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 100) {
    const mediaType: "image/png" | "image/jpeg" = trimmed.startsWith("iVBOR") ? "image/png" : "image/jpeg";
    return { mediaType, data: trimmed };
  }
  return null;
}

function buildSystemPrompt(language: PreferredLanguage, equation: string, expectedAnswer: number): string {
  const langName = languageLabel(language);
  return [
    `You are Maya, a warm and precise math tutor on the AIS learning platform.`,
    `A student is solving a basic linear equation by hand on paper. They have uploaded a photo of their working.`,
    ``,
    `The equation they're solving: ${equation}`,
    `The correct answer: x = ${expectedAnswer}`,
    ``,
    `Your job:`,
    `1. Read the handwritten work in the image carefully.`,
    `2. Decide if their final answer matches the correct answer.`,
    `3. If wrong, identify the SPECIFIC mistake (sign error, arithmetic slip, dropped step, mis-applied operation, etc.).`,
    `4. If the image is unreadable / blank / not math, set isCorrect to false and explain you couldn't read the work.`,
    ``,
    `Respond ONLY in ${langName}. Be warm but direct. Keep "feedback" under 40 words. Each entry in "mistakes" should be one short sentence.`,
    ``,
    `Output exactly one JSON object with this schema, and nothing else (no prose, no markdown fences, no commentary):`,
    `{`,
    `  "isCorrect": boolean,`,
    `  "detectedAnswer": number or null,`,
    `  "feedback": string,`,
    `  "mistakes": [string, ...]`,
    `}`,
  ].join("\n");
}

function safeParse(text: string): GraderResult | null {
  // Claude usually obeys "no markdown fences" but it's free, so strip them
  // defensively before parsing.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(stripped);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.isCorrect === "boolean" &&
      typeof parsed.feedback === "string" &&
      Array.isArray(parsed.mistakes)
    ) {
      return {
        isCorrect: parsed.isCorrect,
        detectedAnswer:
          typeof parsed.detectedAnswer === "number" ? parsed.detectedAnswer : null,
        feedback: parsed.feedback,
        mistakes: parsed.mistakes.filter((m: unknown): m is string => typeof m === "string"),
      };
    }
  } catch {
    // fallthrough
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request body." }, { status: 400 });
  }

  const equation = typeof body.equation === "string" ? body.equation.trim() : "";
  const expectedAnswer = typeof body.expectedAnswer === "number" ? body.expectedAnswer : NaN;
  const language: PreferredLanguage = (body.language ?? "en") as PreferredLanguage;
  const imageInput = typeof body.image === "string" ? body.image : "";

  if (!equation || Number.isNaN(expectedAnswer) || !imageInput) {
    return NextResponse.json(
      { error: "Missing equation, expectedAnswer, or image." },
      { status: 400 },
    );
  }

  const parsed = parseImage(imageInput);
  if (!parsed) {
    return NextResponse.json(
      { error: "Image must be base64 JPEG/PNG/WebP/GIF (or a data: URL)." },
      { status: 400 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured." }, { status: 503 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: buildSystemPrompt(language, equation, expectedAnswer),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: parsed.mediaType, data: parsed.data },
            },
            {
              type: "text",
              text: `Equation: ${equation}\nCorrect answer: x = ${expectedAnswer}\nGrade the student's working in the image and respond in the required JSON shape.`,
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    const result = safeParse(text);
    if (!result) {
      return NextResponse.json(
        {
          error: "Could not parse model response.",
          raw: text.slice(0, 500),
        },
        { status: 502 },
      );
    }
    return NextResponse.json(result satisfies GraderResult);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: `Grader failed: ${msg}` }, { status: 502 });
  }
}
