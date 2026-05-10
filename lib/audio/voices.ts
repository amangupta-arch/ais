/** Per-language ElevenLabs voice IDs.
 *
 *  How to fill this in:
 *    1. Pick a voice from https://elevenlabs.io/voice-library (or your
 *       account's "My Voices" tab) for each language.
 *    2. Copy the voice's ID (a 20-char string like "21m00Tcm4TlvDq8ikWAM")
 *       and paste it on the matching line below.
 *
 *  Languages without a configured voice ID will be SKIPPED at TTS time
 *  — the YAML still generates and the lesson still goes live as text;
 *  /yaml-status will show "audio: not configured" for that language.
 *
 *  Hinglish: ElevenLabs has no separate Hinglish voice. Use a Hindi
 *  voice you've tested with English code-switching — multilingual_v2
 *  generally handles the language mix smoothly.
 */

export const VOICE_IDS: Record<string, string | null> = {
  en:       "gHu9GtaHOXcSqFTK06ux",
  hi:       "gHu9GtaHOXcSqFTK06ux",
  hinglish: "gHu9GtaHOXcSqFTK06ux", // ElevenLabs has no separate Hinglish voice; uses Hindi
  mr:       "RBxPIvrKOP4ugCK2jVHD", // TODO: paste Marathi voice id
  pa:       "RxnH5jCRKb1ez2lcmQC1", // TODO: paste Punjabi voice id
  te:       "EMxdghWQV7gqV33j4J3F", // TODO: paste Telugu voice id
  ta:       "hhPtGvkQC1ce5z3pPhYh", // TODO: paste Tamil voice id
  bn:       "WiaIVvI1gDL4vT4y7qUU", // TODO: paste Bengali voice id
  fr:       "zPy2sgLU4pZ7Xrjh87uz", // TODO: paste French voice id
  es:       "zl1Ut8dvwcVSuQSB9XkG", // TODO: paste Spanish voice id
};

export const TTS_MODEL = "eleven_multilingual_v2";

export function voiceIdFor(language: string): string | null {
  return VOICE_IDS[language] ?? null;
}
