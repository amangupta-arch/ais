// Server-side Meta Conversions API client.
//
// Fire-and-forget at every call site: if Meta is down or the env
// vars are missing, the function never throws — it logs to Sentry
// and returns. Payment flows must NEVER break because Meta is
// unhappy.
//
// Env vars:
//   NEXT_PUBLIC_META_PIXEL_ID    — required (also used by the
//                                   browser Pixel; PUBLIC is fine)
//   META_CAPI_ACCESS_TOKEN       — required, server-only secret
//   META_TEST_EVENT_CODE         — optional, enables Meta's Test
//                                   Events tab for dev/staging

import * as Sentry from "@sentry/nextjs";

import type { CapiEventInput } from "./types";

const GRAPH_VERSION = "v18.0";

export function metaCapiConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_META_PIXEL_ID &&
      process.env.META_CAPI_ACCESS_TOKEN,
  );
}

export async function sendCapiEvent(event: CapiEventInput): Promise<void> {
  if (!metaCapiConfigured()) return;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID!;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN!;
  const testCode = process.env.META_TEST_EVENT_CODE;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data: stripUndefined(event.userData),
        custom_data: event.customData ? stripUndefined(event.customData) : undefined,
      },
    ],
  };
  if (testCode) payload.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      Sentry.captureMessage(
        `[meta-capi] ${event.eventName} non-ok response ${res.status}: ${body.slice(0, 500)}`,
        "warning",
      );
    }
  } catch (e) {
    Sentry.captureException(e, {
      tags: { source: "meta-capi", event: event.eventName },
    });
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
