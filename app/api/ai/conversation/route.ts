import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { PERSONAS, type Persona } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  systemPrompt?: string;
  goal?: string;
  successCriteria?: string;
  starterText?: string;
  maxTurns?: number;
  personaId?: Persona["id"];
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

const preamble = (persona: Persona) =>
  `You are ${persona.name}, a ${persona.tagline} AI tutor. ` +
  `Keep every reply under 40 words. Be warm but direct. ` +
  `When the goal is reached, include <END/> at the end of your message.`;

export async function POST(request: NextRequest) {
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
        "(Coach is offline — ANTHROPIC_API_KEY isn't configured. " +
        "Pretend I asked a sharp follow-up, and jot one sentence of reflection.) <END/>".replace(" <END/>", ""),
      shouldEnd: true,
    });
  }

  const persona = PERSONAS.find((p) => p.id === body.personaId) ?? PERSONAS[0]!;
  const userMessages = (body.messages ?? []).filter(
    (m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );

  // If this is the first call (no user messages yet) and a starter is provided,
  // echo the starter back to kick off the sub-chat without burning an API call.
  if (userMessages.length === 0 && body.starterText) {
    return NextResponse.json({ message: body.starterText, shouldEnd: false });
  }

  const systemBlocks = [
    preamble(persona),
    body.systemPrompt && `Tutor brief: ${body.systemPrompt}`,
    body.goal && `Goal of this exchange: ${body.goal}`,
    body.successCriteria && `Success criteria: ${body.successCriteria}`,
    typeof body.maxTurns === "number" && `Cap this exchange at ${body.maxTurns} user messages.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: systemBlocks,
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim();

    const cap = typeof body.maxTurns === "number" ? body.maxTurns : Number.POSITIVE_INFINITY;
    const userTurnCount = userMessages.filter((m) => m.role === "user").length;
    const reachedCap = userTurnCount >= cap;
    const hasEnd = /<END\/?>/i.test(text);
    const cleaned = text.replace(/<END\/?>/gi, "").trim();

    return NextResponse.json({
      message: cleaned || "Got it. Let's keep moving.",
      shouldEnd: hasEnd || reachedCap,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Anthropic call failed.";
    return NextResponse.json({ message, shouldEnd: true }, { status: 500 });
  }
}
