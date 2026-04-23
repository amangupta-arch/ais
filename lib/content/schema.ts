import { z } from "zod";

// Keep these in lockstep with lib/turns.ts and the Persona union in lib/types.ts.
const personaId = z.enum(["nova", "arjun", "riya", "sensei"]);

// Every turn type accepts an optional top-level `xp`. The loader maps this to
// lesson_turns.xp_reward; for mcq and checkpoint it also mirrors into the
// content jsonb so the UI can render the "+X XP" chip.
const withXp = { xp: z.number().int().nonnegative().optional() };

const tutorMessageTurn = z.object({
  type: z.literal("tutor_message"),
  persona: personaId.optional(),
  typing_ms: z.number().int().positive().optional(),
  reveal_style: z.enum(["fade", "typewriter"]).optional(),
  text: z.string().min(1),
  ...withXp,
});

const mcqOption = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  is_correct: z.boolean(),
  rationale: z.string().optional(),
});
const mcqTurn = z.object({
  type: z.literal("mcq"),
  question: z.string().min(1),
  allow_multiple: z.boolean().optional(),
  options: z.array(mcqOption).min(2),
  ...withXp,
});

const freeTextTurn = z.object({
  type: z.literal("free_text"),
  prompt: z.string().min(1),
  placeholder: z.string().optional(),
  min_chars: z.number().int().positive().optional(),
  rubric: z.string().optional(),
  ...withXp,
});

const reflectionTurn = z.object({
  type: z.literal("reflection"),
  prompt: z.string().min(1),
  placeholder: z.string().optional(),
  ...withXp,
});

const exerciseTurn = z.object({
  type: z.literal("exercise"),
  instruction: z.string().min(1),
  tool: z.string().optional(),
  expected_output_schema: z.string().optional(),
  placeholder: z.string().optional(),
  ...withXp,
});

const aiConversationTurn = z.object({
  type: z.literal("ai_conversation"),
  goal: z.string().min(1),
  max_turns: z.number().int().positive(),
  success_criteria: z.string().min(1),
  starter_text: z.string().min(1),
  system_prompt: z.string().min(1),
  ...withXp,
});

const checkpointTurn = z.object({
  type: z.literal("checkpoint"),
  title: z.string().min(1),
  summary: z.string().min(1),
  ...withXp,
});

const mediaTurn = z.object({
  type: z.literal("media"),
  kind: z.enum(["image", "video"]),
  url: z.string().url(),
  caption: z.string().optional(),
  aspect_ratio: z.number().positive().optional(),
  ...withXp,
});

export const turnSchema = z.discriminatedUnion("type", [
  tutorMessageTurn,
  mcqTurn,
  freeTextTurn,
  reflectionTurn,
  exerciseTurn,
  aiConversationTurn,
  checkpointTurn,
  mediaTurn,
]);

export const lessonSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  estimated_minutes: z.number().int().positive().default(5),
  xp_reward: z.number().int().nonnegative().default(20),
  turns: z.array(turnSchema).min(1),
});

export type LessonYaml = z.infer<typeof lessonSchema>;
export type TurnYaml = z.infer<typeof turnSchema>;

/** Shape we persist into lesson_turns.content — everything except the top-level
 *  fields that belong on the row (`type`, `xp`). For tutor_message we rename
 *  `persona` → `persona_id`. For mcq and checkpoint we mirror xp into content
 *  so the UI can show the "+X XP" chip. */
export function turnContent(turn: TurnYaml): Record<string, unknown> {
  const { type: _t, xp: _xp, ...rest } = turn as TurnYaml & { xp?: number };

  if (turn.type === "tutor_message") {
    const { persona, ...other } = rest as { persona?: string } & Record<string, unknown>;
    return persona ? { ...other, persona_id: persona } : other;
  }

  if ((turn.type === "mcq" || turn.type === "checkpoint") && typeof turn.xp === "number") {
    return { ...rest, xp: turn.xp };
  }

  return rest;
}

export function turnXpReward(turn: TurnYaml): number {
  return turn.xp ?? 0;
}
