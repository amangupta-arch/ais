"use client";

// Fires a one-shot Meta Pixel ViewContent event on mount. Used by
// the lesson page (and any future deep-content page) to signal
// engagement to Meta. Client-only — no CAPI partner, since
// engagement signals don't drive conversion bidding and the volume
// would dwarf our other events.

import { useEffect, useRef } from "react";

import { track } from "./track";

export default function ViewContentBeacon({
  contentId,
  contentName,
  contentCategory,
}: {
  contentId: string;
  contentName?: string;
  contentCategory?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("ViewContent", {
      content_ids: [contentId],
      content_name: contentName,
      content_category: contentCategory,
      content_type: "lesson",
    });
  }, [contentId, contentName, contentCategory]);
  return null;
}
