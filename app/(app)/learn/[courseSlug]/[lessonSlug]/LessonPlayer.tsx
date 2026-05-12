"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Flame, MessagesSquare, Send, Sparkles, Volume2, VolumeX, Zap } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TutorAvatar } from "@/components/ui/TutorAvatar";
import { useAudioNarration, type AudioNarration } from "@/lib/hooks/useAudioNarration";
import type { LessonTurn } from "@/lib/turns";
import type { Persona } from "@/lib/types";
import { personaById } from "@/lib/types";
import Typewriter from "./Typewriter";
import { cn } from "@/lib/utils";

import { advanceTurn, completeLesson } from "./actions";
import { LessonFxProvider, useLessonFx } from "./LessonFxContext";
import {
  FillInTheBlankBlock,
  DragToReorderBlock,
  TapToMatchBlock,
} from "./InteractiveBlocks";
import { continueLabel } from "./labels";

type Props = {
  courseSlug: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonSubtitle: string | null;
  lessonXpReward: number;
  courseId: string;
  lessonId: string;
  turns: LessonTurn[];
  personaId: Persona["id"];
  initialTurnIndex: number;
  alreadyCompleted: boolean;
  /** Language the learner is currently viewing. Used to scope progress
   *  writes so a saved turn index from another language doesn't get
   *  applied to a translated turn list of a different length. */
  language: string;
  /** Pre-generated ElevenLabs mp3 URLs keyed by lesson_turns.order_index.
   *  When the active turn has an entry here, the player plays those
   *  urls instead of falling back to browser TTS. */
  audioByTurn?: Record<number, string[]>;
};

type ChatMessage = { role: "user" | "assistant"; content: string };

// Tools for which we keep the user inside the app via a Claude-backed practice
// chat, instead of launching an external tab.
const IN_APP_TOOLS = new Set(["chatgpt", "claude", "gemini", "perplexity"]);

// A gentler curve than `ease-out` for content reveals — feels like a soft
// deceleration rather than a clipped fade. Use for meaningful transitions.
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function LessonPlayer(props: Props) {
  const {
    courseSlug, lessonTitle, lessonSubtitle, lessonXpReward,
    courseId, lessonId, turns, personaId,
    initialTurnIndex, alreadyCompleted, language,
    audioByTurn,
  } = props;

  const persona = useMemo(() => personaById(personaId), [personaId]);
  const audio = useAudioNarration();

  const safeInitial = Math.min(Math.max(0, initialTurnIndex), turns.length - 1);
  const [revealedCount, setRevealedCount] = useState(safeInitial + 1);

  // Lesson-local XP ticker + correct streak — these are visual only; the
  // server is the source of truth for persisted XP via advanceTurn/completeLesson.
  const [xpDisplay, setXpDisplay] = useState(0);
  const [streak, setStreak] = useState(0);
  const xpChipRef = useRef<HTMLDivElement | null>(null);

  const handleXpLanded = useCallback((amount: number) => {
    setXpDisplay((v) => v + amount);
  }, []);
  const handleStreakChange = useCallback((correct: boolean) => {
    setStreak((s) => (correct ? s + 1 : 0));
  }, []);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeTurnRef = useRef<HTMLDivElement | null>(null);

  // Follow-tail scroll: keep the active turn's growth pinned to the
  // viewport bottom (chat-app style — Maya types, the page glides
  // down to the latest word). The earlier behaviour kept the bottom
  // glued unconditionally; the only thing that changes here is that
  // we PAUSE the follow as soon as the user scrolls upward to read
  // an earlier line, and RESUME the moment they scroll back near the
  // bottom. The prior failure modes (typing-dots height swap, Framer
  // layout animation racing the smooth scroll, async image/audio
  // layout shifts) are still handled by the ResizeObserver.
  useEffect(() => {
    const node = activeTurnRef.current;
    if (!node) return;

    let lastH = node.getBoundingClientRect().height;
    // Tracks whether the user wants the page to keep following the
    // tail. Starts true; flips false the moment the user manually
    // scrolls more than `STOP_PX` away from the bottom; flips back
    // true once they're within `RESUME_PX` of the bottom again.
    let autoFollow = true;
    // Auto-scrolls we trigger also fire 'scroll' events. Stamp a
    // short window during which any scroll event is ignored so we
    // don't read our own keystrokes.
    let programmaticUntil = 0;

    const STOP_PX = 120;
    const RESUME_PX = 80;

    const distanceFromBottom = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return Math.max(0, max - window.scrollY);
    };

    const pinBottom = (smooth: boolean) => {
      programmaticUntil = Date.now() + 250;
      node.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    };

    const onScroll = () => {
      if (Date.now() < programmaticUntil) return;
      const d = distanceFromBottom();
      if (autoFollow && d > STOP_PX) autoFollow = false;
      else if (!autoFollow && d < RESUME_PX) autoFollow = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Initial smooth scroll on advance — two rAFs let Framer mount + lay
    // out the new motion.div before we measure.
    const id1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        pinBottom(true);
      });
    });

    // Re-pin instantly on every growth tick — but only when auto-
    // follow is on. If the user scrolled up to re-read, we leave
    // them alone; the typewriter keeps going and they can catch up
    // by scrolling back down (RESUME_PX re-arms the follow).
    const ro = new ResizeObserver(() => {
      const h = node.getBoundingClientRect().height;
      if (h > lastH + 0.5) {
        if (autoFollow) pinBottom(false);
      }
      lastH = h;
    });
    ro.observe(node);

    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(id1);
      ro.disconnect();
    };
  }, [revealedCount]);

  // Drive narration from the parent so we can replay on activate AND on
  // audio-toggle. The TutorMessage renderer no longer owns this; the
  // dedupe key it used blocked re-speaks when the user toggled audio on
  // mid-lesson. Tracks (turnId, enabled) so re-renders don't re-speak,
  // but a real change (new turn, or audio just turned on) does.
  //
  // Prefer the pre-generated ElevenLabs mp3s from `audioByTurn` when
  // present (any turn type) — they're keyed by lesson_turns.order_index.
  // Fall back to browser TTS only for tutor_message turns when no
  // mp3 manifest entry exists.
  const lastSpokenSigRef = useRef<string | null>(null);
  useEffect(() => {
    const idx = revealedCount - 1;
    const active = turns[idx];
    if (!active) return;
    const clipUrls = audioByTurn?.[active.order_index] ?? [];
    const hasClips = clipUrls.length > 0;
    const isTutor = active.turn_type === "tutor_message";
    if (!hasClips && !isTutor) return;

    const sig = `${active.id}::${audio.enabled ? 1 : 0}::${hasClips ? "mp3" : "tts"}`;
    if (lastSpokenSigRef.current === sig) return;
    lastSpokenSigRef.current = sig;

    if (!audio.enabled) {
      audio.cancel();
      return;
    }

    // Wait one tick for typing-dots → text transition (tutor only).
    const wait = isTutor
      ? (active.turn_type === "tutor_message"
          ? (active.content.typing_ms ?? 1000) + 200
          : 0)
      : 200;
    const t = setTimeout(() => {
      audio.cancel();
      if (hasClips) {
        audio.playClips(clipUrls);
      } else if (active.turn_type === "tutor_message") {
        audio.speak(active.content.text);
      }
    }, wait);
    return () => clearTimeout(t);
  }, [revealedCount, turns, audio, audioByTurn]);

  const goNext = useCallback(
    (opts?: { xp?: number; source?: string }) => {
      // Cut any in-flight tutor narration the moment the user advances,
      // so audio never bleeds across the juncture into the next turn.
      audio.cancel();
      const idx = revealedCount - 1;
      if (idx >= 0 && idx < turns.length) {
        const currentTurn = turns[idx];
        if (!alreadyCompleted && currentTurn) {
          void advanceTurn({
            courseId,
            lessonId,
            turnIndex: idx,
            xpAwarded: opts?.xp ?? currentTurn.xp_reward,
            source: opts?.source ?? `turn:${currentTurn.turn_type}`,
            language,
          });
        }
      }
      setRevealedCount((c) => Math.min(turns.length, c + 1));
    },
    [alreadyCompleted, audio, courseId, language, lessonId, revealedCount, turns],
  );

  // Step back to the previous turn — undoes the last advance. Used by the
  // back button next to the progress bar. Cancels in-flight narration so
  // we don't speak the new active turn over the old one.
  const goBack = useCallback(() => {
    audio.cancel();
    setRevealedCount((c) => Math.max(1, c - 1));
  }, [audio]);

  const active = turns[revealedCount - 1];
  const onLastTurn = revealedCount >= turns.length;
  const canGoBack = revealedCount > 1;

  return (
    <LessonFxProvider
      audioEnabled={audio.enabled}
      xpTargetRef={xpChipRef}
      onXpLanded={handleXpLanded}
      onStreakChange={handleStreakChange}
    >
      {/* Bound the lesson player to viewport height so the inner scroller
          actually scrolls — without this, page contents push the body to
          grow and `position: sticky` on the progress bar has no effect
          because the inner div never overflows. */}
      <div
        className="lm-page flex flex-col"
        style={{ height: "100dvh", overflow: "hidden" }}
      >
        <Header
          lessonTitle={lessonTitle}
          lessonSubtitle={lessonSubtitle}
          courseSlug={courseSlug}
          audio={audio}
          xpDisplay={xpDisplay}
          streak={streak}
          xpChipRef={xpChipRef}
        />

        <div ref={scrollerRef} className="flex-1 overflow-y-auto">
          {/* Sticky progress bar — pins below the header so the user
              always knows where they are in the lesson, even after
              scrolling back to re-read earlier turns. */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 5,
              background: "var(--bg)",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <div
              className="mx-auto max-w-2xl flex items-center"
              style={{ padding: "12px 20px", gap: 12 }}
            >
              <button
                type="button"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Back to previous segment"
                className="lm-btn lm-btn--icon"
                style={{
                  flexShrink: 0,
                  background: canGoBack ? "var(--ocean-soft)" : undefined,
                  color: canGoBack ? "var(--ocean-deep)" : undefined,
                  opacity: canGoBack ? 1 : 0.35,
                  cursor: canGoBack ? "pointer" : "not-allowed",
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ProgressBar current={revealedCount} total={turns.length} />
              </div>
            </div>
          </div>
          <div
            className="mx-auto max-w-2xl px-5 flex flex-col gap-5"
            style={{ paddingTop: 24, paddingBottom: 24 }}
          >

            {/* Scrollable transcript — every revealed turn stays mounted
                so the user can scroll back to re-read tutor lines or
                review past answers. Past (non-active) turns render at
                65% opacity to keep the active turn at the bottom in
                visual focus without losing readability of history. */}
            <AnimatePresence initial={false}>
              {turns.slice(0, revealedCount).map((turn, i) => {
                const isActive = i === revealedCount - 1;
                return (
                  <motion.div
                    key={turn.id ?? i}
                    ref={isActive ? activeTurnRef : undefined}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: isActive ? 1 : 0.65, y: 0 }}
                    transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
                    style={{ scrollMarginBottom: 24 }}
                  >
                    <TurnView
                      turn={turn}
                      persona={persona}
                      audio={audio}
                      isActive={isActive}
                      onContinue={goNext}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {onLastTurn && active?.turn_type === "checkpoint" ? (
              <CompleteCta
                courseSlug={courseSlug}
                courseId={courseId}
                lessonId={lessonId}
                lessonXpReward={lessonXpReward}
                alreadyCompleted={alreadyCompleted}
                language={language}
              />
            ) : null}
          </div>
        </div>
      </div>
    </LessonFxProvider>
  );
}

function Header({
  lessonTitle, lessonSubtitle, courseSlug, audio, xpDisplay, streak, xpChipRef,
}: {
  lessonTitle: string;
  lessonSubtitle: string | null;
  courseSlug: string;
  audio: AudioNarration;
  xpDisplay: number;
  streak: number;
  xpChipRef: RefObject<HTMLDivElement | null>;
}) {
  const Icon = audio.enabled ? Volume2 : VolumeX;
  return (
    <header
      className="sticky top-0 z-10"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="mx-auto max-w-2xl px-5 py-3 flex items-center gap-3">
        <Link
          href={`/learn/${courseSlug}`}
          className="lm-btn lm-btn--icon"
          aria-label="Back to course"
        >
          <span aria-hidden style={{ fontSize: 18 }}>←</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p
            className="lm-serif truncate"
            style={{ fontSize: 16, lineHeight: 1.2, color: "var(--text)" }}
          >
            {lessonTitle}
          </p>
          {lessonSubtitle ? (
            <p
              className="truncate"
              style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.02em" }}
            >
              {lessonSubtitle}
            </p>
          ) : null}
        </div>

        <XpChip ref={xpChipRef} value={xpDisplay} />
        <StreakChip value={streak} />

        <button
          type="button"
          aria-pressed={audio.enabled}
          aria-label={audio.enabled ? "Turn audio narration off" : "Turn audio narration on"}
          onClick={audio.toggle}
          className="lm-btn lm-btn--icon"
          style={
            audio.enabled
              ? { background: "var(--indigo-soft)", color: "var(--indigo-deep)" }
              : undefined
          }
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

/** Tiny 28px Nova avatar — the tutor stays present in the header but
 *  doesn't dominate any individual turn's screen real-estate. */
function NovaAvatar({ persona }: { persona: Persona }) {
  const url =
    persona.avatar_url ??
    (process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-avatars/${persona.id}.png`
      : null);
  return (
    <span
      className="lm-avatar lm-avatar--sm"
      aria-label={`${persona.name} avatar`}
      title={persona.name}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span aria-hidden>{persona.name.charAt(0)}</span>
      )}
    </span>
  );
}

const XpChip = ({ ref, value }: { ref: RefObject<HTMLDivElement | null>; value: number }) => (
  <motion.div
    ref={ref}
    className="lm-chip lm-chip--indigo"
    animate={{ scale: value > 0 ? [1, 1.12, 1] : 1 }}
    transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
    key={value}
    aria-label={`${value} XP earned this lesson`}
  >
    <Zap className="h-3.5 w-3.5" />
    <span className="lm-tabular">{value}</span>
  </motion.div>
);

function StreakChip({ value }: { value: number }) {
  if (value <= 0) return null;
  const hot = value >= 3;
  return (
    <motion.div
      key={value}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: hot ? [1, 1.18, 1] : 1, opacity: 1 }}
      transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
      className={cn("lm-chip", hot ? "lm-chip--saffron" : undefined)}
      aria-label={`${value} correct in a row`}
    >
      <Flame className="h-3.5 w-3.5" />
      <span className="lm-tabular">{value}</span>
    </motion.div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="lm-progress flex-1">
        <motion.div
          className="lm-progress__fill"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      </div>
      <span className="lm-mono lm-tabular" style={{ fontSize: 11, color: "var(--text-3)" }}>
        {current}/{total}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ Turn views */

function TurnView({
  turn, persona, audio, isActive, onContinue,
}: {
  turn: LessonTurn;
  persona: Persona;
  audio: AudioNarration;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  switch (turn.turn_type) {
    case "tutor_message":
      return (
        <TutorMessage
          turn={turn}
          persona={persona}
          isActive={isActive}
          onContinue={onContinue}
        />
      );
    case "mcq":
      return <McqBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "free_text":
    case "reflection":
      return <TextInputBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "exercise":
      return <ExerciseBlock turn={turn} persona={persona} isActive={isActive} onContinue={onContinue} />;
    case "ai_conversation":
      return <AiConversationBlock turn={turn} persona={persona} isActive={isActive} onContinue={onContinue} />;
    case "media":
      return <MediaBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "checkpoint":
      return <CheckpointBlock turn={turn} />;
    case "fill_in_the_blank":
      return <FillInTheBlankBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "drag_to_reorder":
      return <DragToReorderBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "tap_to_match":
      return <TapToMatchBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "svg_graphic":
      return <SvgGraphicBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "html_animation":
      return <HtmlAnimationBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
  }
}

function TutorMessage({
  turn, persona, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "tutor_message" }>;
  persona: Persona;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const speaker = personaById(turn.content.persona_id ?? persona.id);
  const typingMs = turn.content.typing_ms ?? 1000;
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowText(true), typingMs);
    return () => clearTimeout(t);
  }, [typingMs]);

  // Speech is now driven from the LessonPlayer parent — see the
  // useEffect that watches revealedCount + audio.enabled. Keeps replay
  // working when the user toggles audio mid-lesson.

  return (
    <div className="flex items-start" style={{ gap: 12, paddingTop: 4 }}>
      <NovaAvatar persona={speaker} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <AnimatePresence mode="wait" initial={false}>
          {!showText ? (
            <motion.div
              key="dots"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-3)",
                  padding: "12px 16px",
                  display: "inline-block",
                }}
              >
                <TypingDots />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            >
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-3)",
                  padding: "14px 18px",
                  maxWidth: "92%",
                }}
              >
                <p
                  className="lm-serif"
                  style={{
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: "var(--text)",
                    whiteSpace: "pre-line",
                  }}
                >
                  <Typewriter text={turn.content.text} />
                </p>
              </div>
              {isActive ? (
                <div className="flex justify-end" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="lm-btn lm-btn--accent"
                    onClick={() => onContinue({ source: "tutor_message" })}
                  >
                    {continueLabel("tutor_message", turn.id)} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Three soft pulsing dots — no card, just inline glyphs. The padding
 *  matches a single line of body text so the height doesn't jump when
 *  the dots dissolve into the message. */
function TypingDots() {
  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 6, paddingTop: 6, paddingBottom: 6 }}
      aria-label="Tutor is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--text-4)",
          }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

function McqBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "mcq" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const fx = useLessonFx();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const selected = turn.content.options.find((o) => o.id === selectedId);
  const done = Boolean(selected?.is_correct);

  const pick = (id: string, ev: ReactMouseEvent<HTMLButtonElement>) => {
    if (done) return;
    const option = turn.content.options.find((o) => o.id === id);
    if (!option) return;
    if (option.is_correct) {
      setSelectedId(id);
      setWrongId(null);
      fx.play("correct");
      fx.haptic.success();
      fx.bumpStreak(true);
      const rect = ev.currentTarget.getBoundingClientRect();
      fx.addXp(turn.xp_reward, rect);
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 280);
      fx.play("wrong");
      fx.haptic.error();
      fx.bumpStreak(false);
    }
  };

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>multiple choice</p>
      <h2
        className="lm-serif"
        style={{ fontSize: 24, lineHeight: 1.2, color: "var(--text)" }}
      >
        {turn.content.question}
      </h2>
      <ul className="flex flex-col" style={{ gap: 10, marginTop: 20 }}>
        {turn.content.options.map((o) => {
          const isSelected = selected?.id === o.id;
          const isWrong = wrongId === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={done && !isSelected}
                onClick={(ev) => pick(o.id, ev)}
                className={cn(
                  "lm-option",
                  isSelected && "lm-option--correct",
                  isWrong && "lm-option--wrong lm-shake",
                  done && !isSelected && "lm-option--dim",
                )}
              >
                <span className="lm-option__index">{o.id.toUpperCase()}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", color: "inherit" }}>{o.text}</span>
                  {isSelected && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                      style={{
                        display: "block",
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--moss-deep)",
                      }}
                    >
                      {o.rationale}
                    </motion.span>
                  ) : isWrong && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        display: "block",
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--coral-deep)",
                      }}
                    >
                      {o.rationale}
                    </motion.span>
                  ) : null}
                </span>
                {isSelected ? (
                  <Check
                    className="h-4 w-4"
                    style={{ marginTop: 2, color: "var(--moss)", flexShrink: 0 }}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {isActive ? (
        <div className="flex items-center" style={{ marginTop: 24, gap: 8 }}>
          {!done ? (
            <button
              type="button"
              className="lm-btn lm-btn--ghost lm-btn--sm"
              onClick={() => onContinue({ xp: 0, source: "skip:mcq" })}
              style={{ color: "var(--text-3)" }}
            >
              Skip
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          {done ? (
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "mcq" })}
            >
              {continueLabel("mcq", turn.id)} <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TextInputBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "free_text" | "reflection" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const minChars = turn.turn_type === "free_text" ? (turn.content.min_chars ?? 10) : 1;
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= minChars;

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>
        {turn.turn_type === "reflection" ? "reflection" : "your turn"}
      </p>
      <h2
        className="lm-serif"
        style={{ fontSize: 24, lineHeight: 1.2, color: "var(--text)" }}
      >
        {turn.content.prompt}
      </h2>
      <textarea
        className="lm-textarea"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={turn.content.placeholder ?? "Write in your own words…"}
        disabled={!isActive}
        style={{ marginTop: 20 }}
      />
      {isActive ? (
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <span
            className="lm-mono lm-tabular"
            style={{ fontSize: 12, color: "var(--text-3)" }}
          >
            {trimmed.length}/{minChars} chars
          </span>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: turn.turn_type })}
            disabled={!canSubmit}
          >
            Submit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ExerciseBlock({
  turn, persona, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "exercise" }>;
  persona: Persona;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const tool = turn.content.tool?.toLowerCase();
  const inApp = tool ? IN_APP_TOOLS.has(tool) : false;

  if (inApp) {
    return (
      <PracticeChat
        turn={turn}
        persona={persona}
        isActive={isActive}
        onContinue={onContinue}
      />
    );
  }

  return <ExternalExerciseBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
}

function ExternalExerciseBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "exercise" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 1;

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>
        {turn.content.tool ? `try in ${turn.content.tool}` : "exercise"}
      </p>
      <h2
        className="lm-serif"
        style={{
          fontSize: 24,
          lineHeight: 1.25,
          color: "var(--text)",
          whiteSpace: "pre-line",
        }}
      >
        {turn.content.instruction}
      </h2>
      <textarea
        className="lm-textarea"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={turn.content.placeholder ?? "Paste here…"}
        disabled={!isActive}
        style={{ marginTop: 20 }}
      />
      {isActive ? (
        <div className="flex justify-end" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: "exercise" })}
            disabled={!canSubmit}
          >
            Submit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** In-app practice chat — replaces "open ChatGPT in another tab" when the
 *  exercise targets a chat tool we can roleplay with Claude. */
function PracticeChat({
  turn, persona, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "exercise" }>;
  persona: Persona;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const content = value.trim();
    if (!content || pending || !isActive) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setValue("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: turn.content.instruction,
          tool: turn.content.tool,
          personaId: persona.id,
          messages: next,
        }),
      });
      const data = (await res.json()) as { message: string; shouldEnd?: boolean };
      setMessages((prev) => [...prev, { role: "assistant" as const, content: data.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  const canFinish = messages.some((m) => m.role === "user");

  return (
    <div
      className="lm-card"
      style={{ overflow: "hidden", padding: 0 }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 8,
          padding: "10px 16px",
          background: "var(--bg-soft)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <MessagesSquare className="h-4 w-4" style={{ color: "var(--indigo)" }} />
        <p
          className="lm-mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          practice sandbox{turn.content.tool ? ` · ${turn.content.tool}-style` : ""}
        </p>
      </div>

      <div style={{ padding: 20 }}>
        <p
          className="lm-serif"
          style={{
            fontSize: 18,
            lineHeight: 1.4,
            color: "var(--text)",
            whiteSpace: "pre-line",
          }}
        >
          {turn.content.instruction}
        </p>

        {messages.length > 0 || pending ? (
          <div className="flex flex-col" style={{ gap: 8, marginTop: 16 }}>
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                >
                  <Bubble role={m.role} content={m.content} persona={persona} />
                </motion.div>
              ))}
            </AnimatePresence>
            {pending ? (
              <div className="flex items-start" style={{ gap: 8 }}>
                <NovaAvatar persona={persona} />
                <TypingDots />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p
            style={{ marginTop: 8, fontSize: 12, color: "var(--coral-deep)" }}
          >
            {error}
          </p>
        ) : null}

        {isActive ? (
          <div className="flex items-end" style={{ gap: 8, marginTop: 16 }}>
            <textarea
              className="lm-textarea"
              rows={2}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Type your prompt…"
              disabled={pending}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={send}
              disabled={pending || value.trim().length === 0}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {isActive && canFinish ? (
          <div className="flex justify-end" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="lm-btn lm-btn--secondary lm-btn--sm"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "exercise_practice" })}
            >
              Done — I&apos;ve had enough practice <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AiConversationBlock({
  turn, persona, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "ai_conversation" }>;
  persona: Persona;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: turn.content.starter_text },
  ]);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const cap = turn.content.max_turns;

  const send = async () => {
    const content = value.trim();
    if (!content || pending || ended) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setValue("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: turn.content.system_prompt,
          goal: turn.content.goal,
          successCriteria: turn.content.success_criteria,
          starterText: turn.content.starter_text,
          maxTurns: cap,
          personaId: persona.id,
          messages: next,
        }),
      });
      const data = (await res.json()) as { message: string; shouldEnd: boolean };
      setMessages((prev) => [...prev, { role: "assistant" as const, content: data.message }]);
      if (data.shouldEnd) setEnded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  const finished = ended || userTurns >= cap;

  return (
    <div className="lm-card" style={{ padding: 20 }}>
      <p
        className="lm-mono"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        <MessagesSquare className="h-3.5 w-3.5 inline" style={{ color: "var(--indigo)", marginRight: 6, verticalAlign: "-2px" }} />
        sub-chat with {persona.name} · max <span className="lm-tabular">{cap}</span> turns
      </p>

      <p style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
        Goal: {turn.content.goal}
      </p>

      <div className="flex flex-col" style={{ gap: 8, marginTop: 16 }}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            >
              {/* Only the starter (i=0, assistant) types out; real
                  responses appear instantly so the back-and-forth feels
                  natural. */}
              <Bubble
                role={m.role}
                content={m.content}
                persona={persona}
                animate={i === 0 && m.role === "assistant"}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {pending ? (
          <div className="flex items-start" style={{ gap: 8 }}>
            <NovaAvatar persona={persona} />
            <TypingDots />
          </div>
        ) : null}
      </div>

      {error ? (
        <p style={{ marginTop: 8, fontSize: 12, color: "var(--coral-deep)" }}>
          {error}
        </p>
      ) : null}

      {!finished ? (
        <div className="flex items-end" style={{ gap: 8, marginTop: 16 }}>
          <textarea
            className="lm-textarea"
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Reply…"
            disabled={!isActive || pending}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={send}
            disabled={!isActive || pending || value.trim().length === 0}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : isActive ? (
        <div className="flex justify-end" style={{ marginTop: 20 }}>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: "ai_conversation" })}
          >
            {continueLabel("ai_conversation", turn.id)} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Bubble({
  role, content, persona, animate,
}: {
  role: ChatMessage["role"];
  content: string;
  persona: Persona;
  /** Type the content out word-by-word. Only meaningful when role
   *  is "assistant"; user bubbles always render instantly. */
  animate?: boolean;
}) {
  if (role === "assistant") {
    return (
      <div className="flex items-start" style={{ gap: 8 }}>
        <NovaAvatar persona={persona} />
        <div
          style={{
            maxWidth: "85%",
            background: "var(--bg-soft)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-3)",
            padding: "10px 14px",
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--text)",
            whiteSpace: "pre-line",
          }}
        >
          {animate ? <Typewriter text={content} /> : content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-end" style={{ gap: 8 }}>
      <div
        style={{
          maxWidth: "85%",
          background: "var(--indigo)",
          color: "#fff",
          borderRadius: "var(--r-3)",
          padding: "10px 14px",
          fontSize: 15,
          lineHeight: 1.5,
          whiteSpace: "pre-line",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function MediaBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "media" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const mediaStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: "var(--r-3)",
    border: "1px solid var(--border)",
    aspectRatio: turn.content.aspect_ratio,
  };
  return (
    <div>
      {turn.content.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={turn.content.url}
          alt={turn.content.caption ?? ""}
          style={mediaStyle}
        />
      ) : (
        <video src={turn.content.url} controls style={mediaStyle} />
      )}
      {turn.content.caption ? (
        <p
          className="lm-serif"
          style={{
            marginTop: 8,
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--text-3)",
          }}
        >
          {turn.content.caption}
        </p>
      ) : null}
      {isActive ? (
        <div className="flex justify-end" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: "media" })}
          >
            {continueLabel("media", turn.id)} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function VisualFigure({
  title, caption, html,
}: {
  title?: string;
  caption?: string;
  html: string;
}) {
  return (
    <figure style={{ margin: 0 }}>
      {title ? (
        <figcaption
          className="lm-mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 8,
          }}
        >
          {title}
        </figcaption>
      ) : null}
      <div
        style={{
          width: "100%",
          borderRadius: "var(--r-3)",
          border: "1px solid var(--border)",
          padding: 16,
          background: "var(--surface-2, #fff)",
          overflow: "hidden",
        }}
        // Trusted-author content from supabase/content/*.yaml — no user input
        // flows here. If that ever changes, sanitize with DOMPurify.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {caption ? (
        <p
          className="lm-serif"
          style={{
            marginTop: 8,
            fontSize: 14,
            fontStyle: "italic",
            color: "var(--text-3)",
          }}
        >
          {caption}
        </p>
      ) : null}
    </figure>
  );
}

function SvgGraphicBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "svg_graphic" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  return (
    <div>
      <VisualFigure title={turn.content.title} caption={turn.content.caption} html={turn.content.svg} />
      {isActive ? (
        <div className="flex justify-end" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: "svg_graphic" })}
          >
            {continueLabel("svg_graphic", turn.id)} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HtmlAnimationBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "html_animation" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  return (
    <div>
      <VisualFigure title={turn.content.title} caption={turn.content.caption} html={turn.content.html} />
      {isActive ? (
        <div className="flex justify-end" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="lm-btn lm-btn--accent"
            onClick={() => onContinue({ xp: turn.xp_reward, source: "html_animation" })}
          >
            {continueLabel("html_animation", turn.id)} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CheckpointBlock({
  turn,
}: {
  turn: Extract<LessonTurn, { turn_type: "checkpoint" }>;
}) {
  const fx = useLessonFx();
  useEffect(() => {
    fx.play("celebrate");
    fx.haptic.success();
  // Fire once when the checkpoint enters the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.id]);

  return (
    <div
      className="lm-card"
      style={{
        background: "var(--indigo-soft)",
        borderColor: "transparent",
        padding: 28,
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 6, color: "var(--indigo-deep)", marginBottom: 6 }}
      >
        <Sparkles className="h-4 w-4" />
        <p
          className="lm-mono"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          checkpoint
        </p>
      </div>
      <p
        className="lm-serif"
        style={{
          fontSize: 28,
          lineHeight: 1.2,
          color: "var(--indigo-deep)",
        }}
      >
        {turn.content.title}
      </p>
      <p
        style={{
          marginTop: 12,
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--text-2)",
          whiteSpace: "pre-line",
        }}
      >
        <Typewriter text={turn.content.summary} />
      </p>
    </div>
  );
}

function CompleteCta({
  courseSlug, courseId, lessonId, lessonXpReward, alreadyCompleted, language,
}: {
  courseSlug: string;
  courseId: string;
  lessonId: string;
  lessonXpReward: number;
  alreadyCompleted: boolean;
  language: string;
}) {
  const router = useRouter();
  const fx = useLessonFx();
  const [pending, start] = useTransition();
  const [awarded, setAwarded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    start(async () => {
      try {
        const res = await completeLesson({ courseId, lessonId, lessonXpReward, language });
        setAwarded(res.awarded);
        if (!res.alreadyCompleted) {
          fx.celebrate();
          fx.play("celebrate");
          fx.haptic.success();
        }
        // Hold the celebration on screen briefly before routing away.
        setTimeout(() => router.push(`/learn/${courseSlug}`), 900);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  if (awarded !== null) {
    return (
      <p
        className="lm-serif"
        style={{
          textAlign: "center",
          fontSize: 16,
          fontStyle: "italic",
          color: "var(--moss-deep)",
        }}
      >
        Saved · <span className="lm-tabular">+{awarded}</span> XP · streak bumped.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center" style={{ gap: 8, paddingBottom: 16 }}>
      <button
        type="button"
        className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
        onClick={onClick}
        disabled={pending}
        style={{ maxWidth: 360 }}
      >
        {pending
          ? "Saving…"
          : alreadyCompleted
            ? "Back to course"
            : `Complete lesson · +${lessonXpReward} XP`}
        <ArrowRight className="h-4 w-4" />
      </button>
      {error ? (
        <span style={{ fontSize: 13, color: "var(--coral-deep)" }}>{error}</span>
      ) : null}
    </div>
  );
}
