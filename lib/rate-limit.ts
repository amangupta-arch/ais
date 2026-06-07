// Per-scope, per-key rolling-window rate limiter backed by the
// public.rate_limits table + rate_limit_check() RPC (see
// supabase/migrations/0020_rate_limits.sql).
//
// Used by /api/ai/math-quiz today and intended for any other public
// LLM-fronting route to bound Anthropic spend.

import { createClient as createServiceClient } from "@supabase/supabase-js";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set; rate limiter cannot run.",
    );
  }
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

/** Atomic check-and-record. Returns `ok: true` and lets the request
 *  through, or `ok: false` with a `retryAfter` (seconds) you should
 *  send as the HTTP `Retry-After` header. */
export async function checkRateLimit(opts: {
  scope: string;
  key: string;
  windowSec: number;
  max: number;
}): Promise<RateLimitResult> {
  const sb = adminClient();
  const { data, error } = await sb.rpc("rate_limit_check", {
    p_scope: opts.scope,
    p_key: opts.key,
    p_window_sec: opts.windowSec,
    p_max: opts.max,
  });
  if (error) {
    // Fail open: if the rate limiter itself is broken, don't 500 the
    // whole route. Surfaces to Sentry via the caller's try/catch path
    // (the LLM call is the expensive part — log and continue).
    console.error("[rate-limit] RPC failed:", error.message);
    return { ok: true };
  }
  const retryAfter = typeof data === "number" ? data : 0;
  if (retryAfter > 0) return { ok: false, retryAfter };
  return { ok: true };
}

/** Extract the client IP from a Vercel-proxied request. In production
 *  Vercel sets `x-forwarded-for` with the real client IP as the first
 *  comma-separated entry; locally this can be spoofed but that's fine
 *  for dev. Falls back to "unknown" so the limiter still applies a
 *  shared cap across origin-less requests instead of letting them
 *  through. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
