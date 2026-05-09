/** Pulls narration text chunks out of a validated lesson YAML.
 *
 *  Scope (matches the v1 "narration only" decision):
 *    - tutor_message.text                                          → 1 chunk
 *    - mcq.question                                                → 1 chunk
 *    - fill_in_the_blank.prompt + template                         → 2 chunks (prompt, template)
 *    - drag_to_reorder.prompt                                      → 1 chunk
 *    - tap_to_match.prompt                                         → 1 chunk
 *    - free_text.prompt                                            → 1 chunk
 *    - reflection.prompt                                           → 1 chunk
 *    - exercise.instruction                                        → 1 chunk
 *    - ai_conversation.starter_text                                → 1 chunk
 *    - media.caption                                               → 1 chunk (only if present)
 *    - svg_graphic.caption / html_animation.caption                → 1 chunk each (if present)
 *    - checkpoint.title  +  checkpoint.summary                     → 2 chunks
 *
 *  Skipped (would explode chunk count without much pedagogical lift):
 *    - mcq option text + rationale  (revealed only after answering)
 *    - drag/tap item labels         (short, non-narrative)
 */

import yaml from "js-yaml";

import { lessonSchema, type LessonYaml } from "@/lib/content/schema";

export type NarrationChunk = {
  /** 1-based position in turns[] — matches lesson_turns.order_index. */
  turnIndex: number;
  /** 0-based position within the same turn (for fill_in_the_blank +
   *  checkpoint which emit two chunks per turn). */
  chunkIndex: number;
  /** What gets sent to ElevenLabs. */
  text: string;
};

function clean(text: string | undefined | null): string | null {
  if (!text) return null;
  // Strip leading/trailing whitespace; collapse internal blank lines but
  // keep single newlines (TTS handles them as pauses).
  const t = text.trim();
  return t.length > 0 ? t : null;
}

export function extractNarrationChunks(doc: LessonYaml): NarrationChunk[] {
  const out: NarrationChunk[] = [];

  doc.turns.forEach((turn, idx) => {
    const turnIndex = idx + 1;
    const push = (chunkIndex: number, text: string | null) => {
      if (text) out.push({ turnIndex, chunkIndex, text });
    };

    switch (turn.type) {
      case "tutor_message":
        push(0, clean(turn.text));
        break;
      case "mcq":
        push(0, clean(turn.question));
        break;
      case "fill_in_the_blank":
        push(0, clean(turn.prompt));
        push(1, clean(turn.template));
        break;
      case "drag_to_reorder":
      case "tap_to_match":
      case "free_text":
      case "reflection":
        push(0, clean(turn.prompt));
        break;
      case "exercise":
        push(0, clean(turn.instruction));
        break;
      case "ai_conversation":
        push(0, clean(turn.starter_text));
        break;
      case "media":
      case "svg_graphic":
      case "html_animation":
        push(0, clean(turn.caption));
        break;
      case "checkpoint":
        push(0, clean(turn.title));
        push(1, clean(turn.summary));
        break;
      default:
        // exhaustiveness — TS will complain if we add a turn type and
        // forget to handle it here.
        ((_x: never) => _x)(turn);
    }
  });

  return out;
}

/** Convenience: parse + validate raw YAML text and extract chunks. */
export function extractFromYamlText(yamlText: string): NarrationChunk[] {
  const raw = yaml.load(yamlText);
  const parsed = lessonSchema.parse(raw);
  return extractNarrationChunks(parsed);
}
