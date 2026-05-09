import type { Persona } from "./types";

export type TutorMessageContent = {
  text: string;
  persona_id?: Persona["id"];
  typing_ms?: number;
  reveal_style?: "fade" | "typewriter";
};

export type McqOption = {
  id: string;
  text: string;
  is_correct: boolean;
  rationale?: string;
};
export type McqContent = {
  question: string;
  options: McqOption[];
  xp?: number;
  allow_multiple?: boolean;
};

export type FreeTextContent = {
  prompt: string;
  placeholder?: string;
  min_chars?: number;
  rubric?: string;
};

export type ReflectionContent = {
  prompt: string;
  placeholder?: string;
};

export type ExerciseContent = {
  instruction: string;
  tool?: "chatgpt" | "gemini" | "claude" | "midjourney" | "canva" | string;
  expected_output_schema?: string;
  placeholder?: string;
};

export type AiConversationContent = {
  system_prompt: string;
  starter_text: string;
  goal: string;
  max_turns: number;
  success_criteria: string;
};

export type CheckpointContent = {
  title: string;
  summary: string;
  xp?: number;
};

export type MediaContent = {
  kind: "image" | "video";
  url: string;
  caption?: string;
  aspect_ratio?: number;
};

// ---- New game-y mechanics -----------------------------------------------

/** Fill-in-the-blank: a template with `{{id}}` tokens replaced by inputs. */
export type FillInTheBlankAnswer = {
  id: string;
  accepted: string[]; // case-insensitive; must match one of these (trimmed)
};
export type FillInTheBlankContent = {
  prompt: string;
  template: string; // e.g. "Role, Task, {{1}}, {{2}}"
  answers: FillInTheBlankAnswer[];
  hint?: string;
  xp?: number;
};

/** Drag-to-reorder: shuffled items the user drags into the correct order. */
export type ReorderItem = { id: string; label: string };
export type DragToReorderContent = {
  prompt: string;
  items: ReorderItem[];
  correct_order: string[]; // ids in the correct sequence
  xp?: number;
};

/** Tap-to-match: two columns; tap a left, then a right, to build a pair. */
export type MatchItem = { id: string; label: string };
export type TapToMatchContent = {
  prompt: string;
  left: MatchItem[];
  right: MatchItem[];
  pairs: [string, string][]; // [leftId, rightId] correct pairings
  xp?: number;
};

// ---- Visual turns -------------------------------------------------------

/** Inline SVG diagram authored in YAML. Trusted-author content; rendered raw. */
export type SvgGraphicContent = {
  title?: string;
  caption?: string;
  svg: string;
  xp?: number;
};

/** Inline HTML+CSS (typically with @keyframes). Trusted-author content. */
export type HtmlAnimationContent = {
  title?: string;
  caption?: string;
  html: string;
  xp?: number;
};

// -------------------------------------------------------------------------

export type TurnType =
  | "tutor_message" | "mcq" | "free_text" | "reflection"
  | "exercise" | "ai_conversation" | "checkpoint" | "media"
  | "fill_in_the_blank" | "drag_to_reorder" | "tap_to_match"
  | "svg_graphic" | "html_animation";

/** Per-language partial override of a turn's content text fields. Keys
 *  inside the override mirror the corresponding *Content type, but every
 *  field is optional — only the fields that need translating are present.
 *  At render time the override is shallow-merged on top of `content`. */
export type LessonTurnTranslations = Record<string, Record<string, unknown>>;

export type LessonTurn =
  | { id: string; order_index: number; turn_type: "tutor_message";      content: TutorMessageContent;     translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "mcq";                content: McqContent;              translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "free_text";          content: FreeTextContent;         translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "reflection";         content: ReflectionContent;       translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "exercise";           content: ExerciseContent;         translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "ai_conversation";    content: AiConversationContent;   translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "checkpoint";         content: CheckpointContent;       translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "media";              content: MediaContent;            translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "fill_in_the_blank";  content: FillInTheBlankContent;   translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "drag_to_reorder";    content: DragToReorderContent;    translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "tap_to_match";       content: TapToMatchContent;       translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "svg_graphic";        content: SvgGraphicContent;       translations: LessonTurnTranslations; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "html_animation";     content: HtmlAnimationContent;    translations: LessonTurnTranslations; xp_reward: number; is_required: boolean };

/** Return a copy of `turn` with `content` shallow-merged with any
 *  language-specific overrides from `translations[lang]` (falling back
 *  to translations.en if present, then to content as authored).
 *
 *  The renderer never reads `translations` directly — pages call this
 *  once before passing turns to the LessonPlayer, so every component
 *  downstream sees a turn whose content is already in the right
 *  language. Empty translations (the common case) yields an unchanged
 *  turn. */
export function localizeTurn(turn: LessonTurn, lang: string): LessonTurn {
  const t = turn.translations;
  if (!t) return turn;
  const override = t[lang] ?? t.en;
  if (!override) return turn;
  return { ...turn, content: { ...turn.content, ...override } } as LessonTurn;
}
