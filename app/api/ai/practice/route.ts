import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import { PERSONAS, type Persona } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  /** The lesson's exercise instruction — given to Claude as context so it can be helpful. */
  brief?: string;
  /** Which tool the user is practicing (chatgpt | claude | gemini | etc.) — informational only. */
  tool?: string;
  personaId?: Persona["id"];
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

const preamble = (persona: Persona, brief: string | undefined, tool: string | undefined) =>
  [
    `You are ${persona.name}, a ${persona.tagline} tutor inside the AIS app.`,
    `The user is practicing a skill they just learned in a lesson.` +
      (tool ? ` They are roleplaying as if this were ${tool}, but they are actually chatting with Claude inside the AIS practice sandbox.` : ""),
    brief
      ? `The exercise the user was given: """${brief}""". When the user writes, respond the way the tool they're practicing with would — helpfully, competently, on-topic. Keep replies under 120 words. Don't coach, don't lecture — just respond like the tool would. If they ask for coaching, briefly suggest one improvement.`
      : "Respond helpfully and concisely.",
  ].join("\n\n");

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { message: "Sign in to use the practice chat.", shouldEnd: true },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "Bad request body.", shouldEnd: true }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      message:
        "(Practice sandbox is offline — ANTHROPIC_API_KEY isn't configured. " +
        "Imagine I responded helpfully. Hit Done when you've had enough practice.)",
      shouldEnd: false,
    });
  }

  const persona = PERSONAS.find((p) => p.id === body.personaId) ?? PERSONAS[0]!;
  const userMessages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );

  if (userMessages.length === 0) {
    return NextResponse.json(
      { message: "Send a message to begin.", shouldEnd: false },
      { status: 400 },
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: preamble(persona, body.brief, body.tool),
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    return NextResponse.json({ message: text || "…", shouldEnd: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Anthropic call failed.";
    return NextResponse.json({ message, shouldEnd: true }, { status: 500 });
  }
}
