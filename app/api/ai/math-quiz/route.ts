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
    `4. If the image is unreadable / blank / not math, set isCorrect to false and use the feedback to explain you couldn't read the work.`,
    ``,
    `Respond ONLY in ${langName}. Be warm but direct. Keep "feedback" under 40 words. Each entry in "mistakes" should be one short sentence.`,
    ``,
    `Use the submit_grade tool to return your assessment. Do not produce any other output.`,
  ].join("\n");
}

// Force structured output via tool_use. Earlier we asked Claude to
// return raw JSON in text and parsed it ourselves — that occasionally
// failed when the model wrapped the JSON in prose or got truncated
// mid-object on longer-script languages. tool_use makes the schema
// non-negotiable and removes the parsing layer entirely.
const GRADE_TOOL: Anthropic.Tool = {
  name: "submit_grade",
  description:
    "Submit the assessment of the student's handwritten math work. Always call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      isCorrect: {
        type: "boolean",
        description: "true if the student's final answer matches the correct answer.",
      },
      detectedAnswer: {
        type: ["number", "null"],
        description:
          "The numeric value of x the student wrote down, or null if you can't read it.",
      },
      feedback: {
        type: "string",
        description:
          "One short paragraph (≤ 40 words) of warm, specific feedback in the required language.",
      },
      mistakes: {
        type: "array",
        items: { type: "string" },
        description:
          "If isCorrect is false, one short sentence per mistake. Empty array when correct.",
      },
    },
    required: ["isCorrect", "detectedAnswer", "feedback", "mistakes"],
  },
};

function extractToolResult(response: Anthropic.Message): GraderResult | null {
  for (const block of response.content) {
    if (block.type !== "tool_use" || block.name !== "submit_grade") continue;
    const input = block.input as {
      isCorrect?: unknown;
      detectedAnswer?: unknown;
      feedback?: unknown;
      mistakes?: unknown;
    };
    if (
      typeof input.isCorrect === "boolean" &&
      typeof input.feedback === "string" &&
      Array.isArray(input.mistakes)
    ) {
      return {
        isCorrect: input.isCorrect,
        detectedAnswer:
          typeof input.detectedAnswer === "number" ? input.detectedAnswer : null,
        feedback: input.feedback,
        mistakes: input.mistakes.filter((m): m is string => typeof m === "string"),
      };
    }
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
      // 1024 leaves comfortable headroom for longer-script languages
      // (Devanagari, Tamil, Telugu) where the same word costs more
      // tokens; the previous 600 occasionally truncated mid-output.
      max_tokens: 1024,
      system: buildSystemPrompt(language, equation, expectedAnswer),
      tools: [GRADE_TOOL],
      tool_choice: { type: "tool", name: "submit_grade" },
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
              text: `Equation: ${equation}\nCorrect answer: x = ${expectedAnswer}\nGrade the student's working in the image and call submit_grade with your assessment.`,
            },
          ],
        },
      ],
    });

    const result = extractToolResult(response);
    if (!result) {
      // Genuinely shouldn't happen with tool_choice forced, but if the
      // model ever stops without calling the tool we surface enough
      // detail for debugging without dumping the whole response.
      return NextResponse.json(
        {
          error: "Could not parse model response.",
          stopReason: response.stop_reason,
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
