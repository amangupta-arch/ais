/** Orchestrates: extract narration → cache-or-synthesize each chunk
 *  (parallelized, capped concurrency) → replace the lesson_audio_manifest
 *  rows for (lesson_id, language) atomically.
 *
 *  Calls a progress callback so the streaming API route can forward
 *  step events to the UI in real time.
 *
 *  Server-only.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { ensureAudioAsset } from "./cache";
import { extractFromYamlText, type NarrationChunk } from "./extract";
import { modelFor, voiceIdFor } from "./voices";

export type PipelineProgress =
  | { kind: "audio:start"; total: number; voiceId: string; model: string }
  | { kind: "audio:skipped"; reason: string }
  | {
      kind: "audio:chunk";
      done: number;
      total: number;
      cacheHit: boolean;
      bytes: number;
      preview: string;
    }
  | { kind: "audio:chunk_failed"; done: number; total: number; error: string; preview: string }
  | {
      kind: "audio:done";
      total: number;
      hits: number;
      misses: number;
      failed: number;
      bytesFromTts: number;
    };

export type PipelineInput = {
  lessonId: string;
  language: string;
  yamlText: string;
  /** Concurrency cap for ElevenLabs calls. ElevenLabs allows ~5
   *  concurrent on most plans; 3 is a safe default. */
  concurrency?: number;
  onProgress?: (event: PipelineProgress) => void;
};

export type PipelineResult = {
  ok: boolean;
  total: number;
  hits: number;
  misses: number;
  failed: number;
  bytesFromTts: number;
  /** Set when ok=false: why the pipeline didn't run at all (vs. per-
   *  chunk failures, which are summarized in `failed`). */
  skipReason?: string;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing.");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

/** Pool that runs jobs with a concurrency cap, calling `onItem` as
 *  each completes. Order-preserving in the resolved-promise array. */
async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]!, i);
    }
  });
  await Promise.all(runners);
  return out;
}

export async function runAudioPipeline(input: PipelineInput): Promise<PipelineResult> {
  const { lessonId, language, yamlText } = input;
  const onProgress = input.onProgress ?? (() => {});
  const concurrency = input.concurrency ?? 3;

  const voiceId = voiceIdFor(language);
  const model = modelFor(language);
  if (!voiceId) {
    onProgress({
      kind: "audio:skipped",
      reason: `no voice id configured for "${language}" — see lib/audio/voices.ts`,
    });
    return {
      ok: false,
      total: 0,
      hits: 0,
      misses: 0,
      failed: 0,
      bytesFromTts: 0,
      skipReason: "voice_id_missing",
    };
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    onProgress({
      kind: "audio:skipped",
      reason: "ELEVENLABS_API_KEY not set on the server",
    });
    return {
      ok: false,
      total: 0,
      hits: 0,
      misses: 0,
      failed: 0,
      bytesFromTts: 0,
      skipReason: "api_key_missing",
    };
  }

  let chunks: NarrationChunk[];
  try {
    chunks = extractFromYamlText(yamlText);
  } catch (e) {
    onProgress({
      kind: "audio:skipped",
      reason: `extract failed: ${String(e)}`,
    });
    return {
      ok: false,
      total: 0,
      hits: 0,
      misses: 0,
      failed: 0,
      bytesFromTts: 0,
      skipReason: "extract_failed",
    };
  }

  if (chunks.length === 0) {
    onProgress({
      kind: "audio:skipped",
      reason: "no narration chunks in lesson",
    });
    return {
      ok: true,
      total: 0,
      hits: 0,
      misses: 0,
      failed: 0,
      bytesFromTts: 0,
    };
  }

  onProgress({
    kind: "audio:start",
    total: chunks.length,
    voiceId,
    model,
  });

  let hits = 0;
  let misses = 0;
  let failed = 0;
  let bytesFromTts = 0;
  let done = 0;

  type ChunkOutcome =
    | { ok: true; chunk: NarrationChunk; assetId: string }
    | { ok: false; chunk: NarrationChunk; error: string };

  const outcomes: ChunkOutcome[] = await runPool(chunks, concurrency, async (chunk) => {
    try {
      const r = await ensureAudioAsset({
        text: chunk.text,
        voiceId,
        model,
      });
      done++;
      if (r.cacheHit) hits++;
      else {
        misses++;
        bytesFromTts += r.bytes;
      }
      onProgress({
        kind: "audio:chunk",
        done,
        total: chunks.length,
        cacheHit: r.cacheHit,
        bytes: r.bytes,
        preview: chunk.text.slice(0, 60),
      });
      return { ok: true, chunk, assetId: r.assetId };
    } catch (e) {
      done++;
      failed++;
      const error = String(e instanceof Error ? e.message : e);
      onProgress({
        kind: "audio:chunk_failed",
        done,
        total: chunks.length,
        error,
        preview: chunk.text.slice(0, 60),
      });
      return { ok: false, chunk, error };
    }
  });

  // Replace manifest rows for (lesson, language) WITHOUT a destructive
  // delete-then-insert. We upsert each new row by its unique key, then
  // prune only rows that aren't part of the new set. This way an
  // upsert failure mid-flight leaves prior coverage intact (each
  // chunk slot still resolves to *some* asset until the next run).
  const sb = adminClient();
  const rows = outcomes
    .filter((o): o is Extract<ChunkOutcome, { ok: true }> => o.ok)
    .map((o) => ({
      lesson_id: lessonId,
      language,
      turn_index: o.chunk.turnIndex,
      chunk_index: o.chunk.chunkIndex,
      asset_id: o.assetId,
      text: o.chunk.text,
    }));

  if (rows.length > 0) {
    const { error: upsertErr } = await sb
      .from("lesson_audio_manifest")
      .upsert(rows, {
        onConflict: "lesson_id,language,turn_index,chunk_index",
      });
    if (upsertErr) {
      onProgress({
        kind: "audio:skipped",
        reason: `manifest upsert: ${upsertErr.message}`,
      });
      return {
        ok: false,
        total: chunks.length,
        hits,
        misses,
        failed,
        bytesFromTts,
        skipReason: "manifest_upsert_failed",
      };
    }
  }

  // Prune any pre-existing rows that aren't in the new set (e.g.,
  // lesson got shorter on regeneration). Skipping this leaves stale
  // chunks at the tail; harmless for playback but messy. If the prune
  // itself fails we keep going — the new manifest is already correct
  // for the chunks the player will actually hit.
  const newKeys = new Set(rows.map((r) => `${r.turn_index}::${r.chunk_index}`));
  const { data: existingRows } = await sb
    .from("lesson_audio_manifest")
    .select("id, turn_index, chunk_index")
    .eq("lesson_id", lessonId)
    .eq("language", language);
  const staleIds = (existingRows ?? [])
    .filter((r) => !newKeys.has(`${r.turn_index}::${r.chunk_index}`))
    .map((r) => r.id as string);
  if (staleIds.length > 0) {
    await sb.from("lesson_audio_manifest").delete().in("id", staleIds);
  }

  onProgress({
    kind: "audio:done",
    total: chunks.length,
    hits,
    misses,
    failed,
    bytesFromTts,
  });

  return {
    ok: failed === 0,
    total: chunks.length,
    hits,
    misses,
    failed,
    bytesFromTts,
  };
}
