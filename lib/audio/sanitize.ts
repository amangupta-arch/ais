/** Strips markdown formatting characters that TTS engines (ElevenLabs +
 *  browser SpeechSynthesis) read literally — `**bold**` plays back as
 *  "asterisk asterisk bold asterisk asterisk" otherwise.
 *
 *  Shared by both narration paths:
 *    - lib/audio/extract.ts → ElevenLabs (server, mp3 cache)
 *    - lib/hooks/useAudioNarration.ts → SpeechSynthesis (browser fallback)
 *
 *  Cases handled:
 *    `**bold**`, `*italic*`, ``code``, `~strike~`, `# headers`, `_emph_`
 *    em/en dashes → ", " for natural pauses
 *    fill_in_the_blank blank tokens (`_____`) → the spoken word "blank"
 *
 *  We do NOT touch initialisms / brand names here — ElevenLabs handles
 *  them natively, and the browser path layers PRONUNCIATIONS on top of
 *  this function via humanizeForSpeech. */
export function stripMarkdown(text: string): string {
  // Order matters: collapse the long-underscore blank token first, before
  // generic `_` stripping eats it.
  let out = text.replace(/_{3,}/g, "blank");
  out = out.replace(/[*_~`#]+/g, "");
  out = out.replace(/[—–]/g, ", ");
  return out;
}
