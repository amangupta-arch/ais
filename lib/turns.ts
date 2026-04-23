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

export type TurnType =
  | "tutor_message" | "mcq" | "free_text" | "reflection"
  | "exercise" | "ai_conversation" | "checkpoint" | "media";

export type LessonTurn =
  | { id: string; order_index: number; turn_type: "tutor_message";   content: TutorMessageContent;   xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "mcq";             content: McqContent;            xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "free_text";       content: FreeTextContent;       xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "reflection";      content: ReflectionContent;     xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "exercise";        content: ExerciseContent;       xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "ai_conversation"; content: AiConversationContent; xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "checkpoint";      content: CheckpointContent;     xp_reward: number; is_required: boolean }
  | { id: string; order_index: number; turn_type: "media";           content: MediaContent;          xp_reward: number; is_required: boolean };
