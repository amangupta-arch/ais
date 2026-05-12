"use client";

// Word-by-word typewriter for prose turns in the lesson player.
//
//   - Reveals one whitespace-delimited token at a time at ~120 ms
//     per word — a calm reading pace that holds the learner's
//     attention without making them wait too long.
//   - Works on any script (English, Devanagari, Tamil, Bengali, …) —
//     splitting on whitespace keeps script-specific conjuncts intact,
//     unlike character-by-character.
//   - One click anywhere on the text (or pressing Space / Enter
//     while focused) instantly reveals the full message — power
//     users escape the animation with one tap.
//   - Resets when the text prop changes, so re-mounting (or a new
//     translation streaming in) starts fresh.
//   - The text node grows in height every word, which the
//     LessonPlayer's ResizeObserver-driven follow-tail scroll picks
//     up naturally: as Maya "types", the viewport stays glued to
//     the latest word.

import { useEffect, useMemo, useRef, useState } from "react";

export default function Typewriter({
  text,
  speedMs = 120,
  className,
  style,
}: {
  text: string;
  /** Milliseconds between each word. */
  speedMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  // Split once per text change. Whitespace runs are kept verbatim so
  // line breaks (\n) and double spaces survive the reveal.
  const tokens = useMemo(() => splitPreservingWhitespace(text), [text]);
  const [shownCount, setShownCount] = useState(0);
  const [done, setDone] = useState(tokens.length === 0);
  const startedAtRef = useRef<number | null>(null);

  // Reset when text changes (e.g., translation arrives, new lesson turn).
  useEffect(() => {
    setShownCount(0);
    setDone(tokens.length === 0);
    startedAtRef.current = null;
  }, [tokens]);

  // Drive the reveal. Anchored to a single startedAt timestamp so
  // pauses from React batching / GC don't accumulate drift.
  useEffect(() => {
    if (done) return;
    if (startedAtRef.current === null) startedAtRef.current = Date.now();

    const id = window.setInterval(() => {
      const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
      const target = Math.min(tokens.length, Math.floor(elapsed / speedMs) + 1);
      setShownCount(target);
      if (target >= tokens.length) {
        setDone(true);
        window.clearInterval(id);
      }
    }, Math.max(16, speedMs / 2));

    return () => window.clearInterval(id);
  }, [tokens, speedMs, done]);

  const visible = done ? text : tokens.slice(0, shownCount).join("");

  const skipToEnd = () => {
    if (done) return;
    setShownCount(tokens.length);
    setDone(true);
  };

  return (
    <span
      role={done ? undefined : "button"}
      tabIndex={done ? -1 : 0}
      aria-label={done ? undefined : "Skip animation"}
      onClick={skipToEnd}
      onKeyDown={(e) => {
        if (done) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          skipToEnd();
        }
      }}
      className={className}
      style={{ cursor: done ? "default" : "pointer", ...style }}
    >
      {visible}
    </span>
  );
}

/** Split `text` into an array of tokens that, joined back, equal `text`.
 *  Every other token alternates between word and whitespace so we can
 *  reveal one logical word per tick while keeping spaces and newlines
 *  intact. */
function splitPreservingWhitespace(text: string): string[] {
  if (!text) return [];
  // /\s+/ keeps the whitespace runs as separators that we re-attach;
  // splitting via regex with a capturing group gives us both halves.
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}
