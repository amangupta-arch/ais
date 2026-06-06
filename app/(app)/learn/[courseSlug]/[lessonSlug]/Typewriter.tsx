"use client";

// Word-by-word typewriter for prose turns in the lesson player.
//
//   - Reveals one token at a time at ~120 ms per word — a calm reading
//     pace that holds the learner's attention without making them wait
//     too long.
//   - Works on any script (English, Devanagari, Tamil, Bengali, …) —
//     splitting on whitespace keeps script-specific conjuncts intact,
//     unlike character-by-character.
//   - Markdown-aware: a complete `**bold**`, `*italic*`, `~~strike~~`,
//     or `:name[text]{attrs}` directive is one indivisible token, so
//     the reader never sees half a `**…**` mid-reveal.
//   - One click anywhere on the text (or pressing Space / Enter
//     while focused) instantly reveals the full message — power
//     users escape the animation with one tap.
//   - Resets when the text prop changes, so re-mounting (or a new
//     translation streaming in) starts fresh.
//   - The text node grows in height every word, which the
//     LessonPlayer's ResizeObserver-driven follow-tail scroll picks
//     up naturally: as the tutor "types", the viewport stays glued to
//     the latest word.

import { useEffect, useMemo, useRef, useState } from "react";
import { RichText } from "@/lib/lesson/RichText";

export default function Typewriter({
  text,
  speedMs = 120,
  className,
  style,
  block = false,
}: {
  text: string;
  /** Milliseconds between each word. */
  speedMs?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Forward to RichText — render real <p>/<ul>/<li> blocks. */
  block?: boolean;
}) {
  const tokens = useMemo(() => tokenize(text), [text]);
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

  // <span> would be invalid as a parent of the <p>/<ul> blocks RichText
  // emits in block mode, so switch the wrapper element accordingly.
  const Wrapper = block ? "div" : "span";
  return (
    <Wrapper
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
      className={block ? `lp-block-text ${className ?? ""}`.trim() : className}
      style={{ cursor: done ? "default" : "pointer", ...style }}
    >
      <RichText block={block}>{visible}</RichText>
    </Wrapper>
  );
}

// Tokenise `text` so that, joined back, the tokens equal `text` exactly,
// AND no token straddles a markdown/directive boundary. The reveal can
// then walk the token list at one-per-tick without flashing literal
// `**` characters before the closing marker arrives.
function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    const span = matchSpan(text, i);
    if (span) {
      tokens.push(text.slice(i, span.end));
      i = span.end;
      continue;
    }
    // Eat until the next char that starts a span (or end of string),
    // then split that chunk by whitespace runs the old way.
    let j = i + 1;
    while (j < text.length && !matchSpan(text, j)) j++;
    for (const part of text.slice(i, j).split(/(\s+)/)) {
      if (part.length > 0) tokens.push(part);
    }
    i = j;
  }
  return tokens;
}

type SpanMatch = { end: number };

function matchSpan(text: string, i: number): SpanMatch | null {
  // **bold**
  if (text.startsWith("**", i)) {
    const end = text.indexOf("**", i + 2);
    if (end > i + 2) return { end: end + 2 };
  }
  // ~~strike~~
  if (text.startsWith("~~", i)) {
    const end = text.indexOf("~~", i + 2);
    if (end > i + 2) return { end: end + 2 };
  }
  // *italic*  — single asterisks not adjacent to another asterisk and
  // following CommonMark's left/right flanking rules (no whitespace
  // immediately inside the delimiters).
  if (
    text[i] === "*" &&
    text[i + 1] !== "*" &&
    text[i - 1] !== "*" &&
    text[i + 1] !== " " &&
    text[i + 1] !== "\n"
  ) {
    const end = text.indexOf("*", i + 1);
    if (end > i + 1 && text[end + 1] !== "*" && text[end - 1] !== " " && text[end - 1] !== "\n") {
      return { end: end + 1 };
    }
  }
  // :name[content]{attrs}  — directive
  const dirMatch = /^:([a-zA-Z][a-zA-Z0-9-]*)\[/.exec(text.slice(i));
  if (dirMatch) {
    const bracketIdx = i + dirMatch[0].length - 1; // points at '['
    const close = findMatchingBracket(text, bracketIdx);
    if (close > 0) {
      let end = close + 1;
      if (text[end] === "{") {
        const closeBrace = text.indexOf("}", end + 1);
        if (closeBrace > 0) end = closeBrace + 1;
      }
      return { end };
    }
  }
  return null;
}

function findMatchingBracket(text: string, start: number): number {
  if (text[start] !== "[") return -1;
  let depth = 1;
  for (let k = start + 1; k < text.length; k++) {
    if (text[k] === "[") depth++;
    else if (text[k] === "]") {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}
