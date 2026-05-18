"use client";

// Typed client-side `track()` helper. Calls drop silently if fbq
// isn't on the page (ad blockers, missing env, SDK not ready yet).
//
// When firing an event that also has a server-side CAPI partner,
// pass the same `eventID` to both — Meta dedupes on (event_name,
// event_id) within a 48-hour window. The dedup IDs we use are
// documented in lib/meta/types.ts (Purchase = orderId, Lead =
// "lead-" + user_id, etc.).

import type { MetaCustomData, MetaEventName } from "./types";

export function track(
  eventName: MetaEventName,
  customData?: MetaCustomData,
  options?: { eventID?: string },
): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (!fbq) return;
  try {
    if (options?.eventID) {
      fbq("track", eventName, customData ?? {}, { eventID: options.eventID });
    } else {
      fbq("track", eventName, customData ?? {});
    }
  } catch {
    /* never let Pixel errors bubble into product code */
  }
}
