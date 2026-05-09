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

// --- Game-y mechanics -----------------------------------------------------

const fillInTheBlankTurn = z.object({
  type: z.literal("fill_in_the_blank"),
  prompt: z.string().min(1),
  template: z.string().min(1),
  answers: z.array(
    z.object({
      id: z.string().min(1),
      accepted: z.array(z.string().min(1)).min(1),
    }),
  ).min(1),
  hint: z.string().optional(),
  ...withXp,
});

const reorderItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
const dragToReorderTurn = z.object({
  type: z.literal("drag_to_reorder"),
  prompt: z.string().min(1),
  items: z.array(reorderItem).min(2),
  correct_order: z.array(z.string().min(1)).min(2),
  ...withXp,
}).refine(
  (v) => v.correct_order.length === v.items.length &&
         v.correct_order.every((id) => v.items.some((it) => it.id === id)),
  { message: "correct_order must list every item.id exactly once" },
);

const svgGraphicTurn = z.object({
  type: z.literal("svg_graphic"),
  title: z.string().optional(),
  caption: z.string().optional(),
  svg: z.string().min(1),
  ...withXp,
});

const htmlAnimationTurn = z.object({
  type: z.literal("html_animation"),
  title: z.string().optional(),
  caption: z.string().optional(),
  html: z.string().min(1),
  ...withXp,
});

const matchItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});
const tapToMatchTurn = z.object({
  type: z.literal("tap_to_match"),
  prompt: z.string().min(1),
  left: z.array(matchItem).min(2),
  right: z.array(matchItem).min(2),
  pairs: z.array(z.tuple([z.string().min(1), z.string().min(1)])).min(2),
  ...withXp,
}).refine(
  (v) => v.left.length === v.right.length &&
         v.pairs.length === v.left.length &&
         v.pairs.every(([l, r]) => v.left.some((x) => x.id === l) && v.right.some((x) => x.id === r)),
  { message: "pairs must cover every left/right id exactly once" },
);

export const turnSchema = z.discriminatedUnion("type", [
  tutorMessageTurn,
  mcqTurn,
  freeTextTurn,
  reflectionTurn,
  exerciseTurn,
  aiConversationTurn,
  checkpointTurn,
  mediaTurn,
  fillInTheBlankTurn,
  dragToReorderTurn,
  tapToMatchTurn,
  svgGraphicTurn,
  htmlAnimationTurn,
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
