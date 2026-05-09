/** Content-addressable cache for ElevenLabs mp3s.
 *
 *  ensureAudioAsset({ text, voiceId, model }):
 *    1. Compute hash = sha256(`${voiceId}|${model}|${text}`).
 *    2. Look up lesson_audio_assets by hash.
 *       - Hit  → return existing asset id + storage_path; cost = 0.
 *       - Miss → call ElevenLabs, upload mp3 to
 *                lesson-audio/<voice_id>/<hash>.mp3, insert the row,
 *                return its id; cost = 1 ElevenLabs call.
 *
 *  This keeps the bucket flat and de-duplicated: identical lines spoken
 *  by the same voice are generated exactly once across all lessons,
 *  even when the same wording appears in different courses.
 */

import { createHash } from "node:crypto";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { synthesize } from "./tts";

const BUCKET = "lesson-audio";

export type EnsureArgs = {
  text: string;
  voiceId: string;
  model: string;
};

export type EnsureResult = {
  assetId: string;
  storagePath: string;
  hash: string;
  cacheHit: boolean;
  bytes: number;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set on the server.");
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export function audioHash(args: EnsureArgs): string {
  return createHash("sha256")
    .update(`${args.voiceId}|${args.model}|${args.text}`)
    .digest("hex");
}

export async function ensureAudioAsset(args: EnsureArgs): Promise<EnsureResult> {
  const sb = adminClient();
  const hash = audioHash(args);
  const storagePath = `${args.voiceId}/${hash}.mp3`;

  // 1. Cache hit? Propagate query errors instead of silently treating
  // them as a miss — a lookup failure (RLS, network, etc.) would
  // otherwise burn ElevenLabs credits on text we already have.
  const { data: hit, error: hitErr } = await sb
    .from("lesson_audio_assets")
    .select("id, storage_path, bytes")
    .eq("hash", hash)
    .maybeSingle();
  if (hitErr) {
    throw new Error(`cache lookup: ${hitErr.message}`);
  }
  if (hit) {
    return {
      assetId: hit.id as string,
      storagePath: hit.storage_path as string,
      hash,
      cacheHit: true,
      bytes: hit.bytes as number,
    };
  }

  // 2. Miss — synthesize.
  const { bytes, contentType } = await synthesize({
    text: args.text,
    voiceId: args.voiceId,
    model: args.model,
  });

  // 3. Upload to storage. upsert:true keeps re-runs idempotent if the
  //    DB row was deleted but the file still exists.
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
      cacheControl: "31536000, immutable",
    });
  if (upErr) {
    throw new Error(`storage upload: ${upErr.message}`);
  }

  // 4. Insert the asset row. We use plain INSERT (not upsert) so a
  //    race-loser can detect the unique-violation, re-fetch the
  //    canonical row, and report cacheHit=true. Without this, two
  //    concurrent requests would both report cacheHit=false and
  //    double-count the bytes-from-tts stat.
  const { data: ins, error: insErr } = await sb
    .from("lesson_audio_assets")
    .insert({
      hash,
      voice_id: args.voiceId,
      model: args.model,
      text: args.text,
      bytes: bytes.length,
      storage_path: storagePath,
    })
    .select("id, storage_path, bytes")
    .single();

  if (insErr) {
    // Postgres unique-violation = "23505". Race winner already wrote
    // the row; we re-fetch and treat as a cache hit.
    const isUnique = (insErr.code as string | undefined) === "23505";
    if (!isUnique) {
      throw new Error(`insert asset: ${insErr.message}`);
    }
    const { data: existing, error: refetchErr } = await sb
      .from("lesson_audio_assets")
      .select("id, storage_path, bytes")
      .eq("hash", hash)
      .single();
    if (refetchErr || !existing) {
      throw new Error(
        `insert lost race + refetch failed: ${refetchErr?.message ?? "no row"}`,
      );
    }
    return {
      assetId: existing.id as string,
      storagePath: existing.storage_path as string,
      hash,
      cacheHit: true,
      bytes: existing.bytes as number,
    };
  }

  return {
    assetId: ins.id as string,
    storagePath: ins.storage_path as string,
    hash,
    cacheHit: false,
    bytes: ins.bytes as number,
  };
}
