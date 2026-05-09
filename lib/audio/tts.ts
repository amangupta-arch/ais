/** Tiny wrapper around the ElevenLabs TTS endpoint.
 *
 *  Returns mp3 bytes. Throws on non-2xx so callers can record the
 *  failure in the cache layer. Uses fetch + arrayBuffer — no SDK
 *  dependency.
 */

import { TTS_MODEL } from "./voices";

export type SynthesizeArgs = {
  text: string;
  voiceId: string;
  /** Override only when experimenting with different models. Defaults
   *  to TTS_MODEL (eleven_multilingual_v2). */
  model?: string;
};

export type SynthesizeResult = {
  bytes: Uint8Array;
  contentType: string;
};

const ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";

export async function synthesize({
  text,
  voiceId,
  model = TTS_MODEL,
}: SynthesizeArgs): Promise<SynthesizeResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set on the server.");
  }

  const url = `${ENDPOINT}/${voiceId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new Error("ElevenLabs returned empty audio.");
  }
  return { bytes: buf, contentType: "audio/mpeg" };
}
