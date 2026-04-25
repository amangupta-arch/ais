"use client";

import { useCallback, useMemo } from "react";

/** Thin wrapper around `navigator.vibrate()`. No-ops on desktop and on any
 *  device that doesn't expose the API. All durations are deliberately short
 *  so they read as "tactile feedback", not "buzz". */
export function useHaptics() {
  const supported = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return typeof (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate === "function";
  }, []);

  const run = useCallback(
    (pattern: number | number[]) => {
      if (!supported) return;
      try {
        (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(pattern);
      } catch {
        /* ignore — some browsers throw without a user gesture */
      }
    },
    [supported],
  );

  return {
    /** Light click when the user taps any tappable element. */
    tap: useCallback(() => run(10), [run]),
    /** Positive confirmation: correct MCQ, pair locked, blanks filled. */
    success: useCallback(() => run([18, 40, 24]), [run]),
    /** Soft negative nudge: wrong MCQ, mismatched pair. */
    error: useCallback(() => run(35), [run]),
  };
}
