"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TutorAvatar } from "@/components/ui/TutorAvatar";
import type { LessonTurn } from "@/lib/turns";
import type { Persona } from "@/lib/types";
import { personaById } from "@/lib/types";
import { cn } from "@/lib/utils";

import { advanceTurn, completeLesson } from "./actions";

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
};

type ChatMessage = { role: "user" | "assistant"; content: string };

const easeWarm = [0.2, 0.8, 0.2, 1] as const;

export function LessonPlayer(props: Props) {
  const {
    courseSlug, lessonTitle, lessonSubtitle, lessonXpReward,
    courseId, lessonId, turns, personaId,
    initialTurnIndex, alreadyCompleted,
  } = props;

  const persona = useMemo(() => personaById(personaId), [personaId]);

  // Scrub initialTurnIndex into [0, turns.length). If the user has completed the
  // lesson already we still let them re-walk it; progress simply won't re-increment.
  const safeInitial = Math.min(Math.max(0, initialTurnIndex), turns.length - 1);

  // revealedCount: how many turns are visible (one-indexed). Starts at 0 then
  // ticks up as tutor_message typings finish or the user advances.
  const [revealedCount, setRevealedCount] = useState(safeInitial + 1);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [revealedCount]);

  // Tutor messages have no "continue" affordance — they auto-advance after the
  // typing-indicator delay, whether the next turn is another tutor_message or
  // an interactive one (MCQ, exercise, etc.). Without this, a lesson deadlocks
  // on any `tutor_message → mcq` boundary.
  useEffect(() => {
    const idx = revealedCount - 1;
    if (idx < 0 || idx >= turns.length) return;
    const turn = turns[idx];
    if (!turn || turn.turn_type !== "tutor_message") return;
    if (idx + 1 >= turns.length) return; // Final turn — let the checkpoint handle it.

    const delay = Math.max(600, (turn.content.typing_ms ?? 1200) + 400);
    const t = setTimeout(() => {
      setRevealedCount((c) => Math.min(turns.length, Math.max(c, idx + 2)));
      if (!alreadyCompleted) {
        void advanceTurn({
          courseId,
          lessonId,
          turnIndex: idx,
          xpAwarded: turn.xp_reward,
          source: "tutor_message",
        });
      }
    }, delay);
    return () => clearTimeout(t);
  }, [revealedCount, turns, alreadyCompleted, courseId, lessonId]);

  const goNext = useCallback(
    (opts?: { xp?: number; source?: string }) => {
      const idx = revealedCount - 1;
      if (idx >= 0 && idx < turns.length) {
        const currentTurn = turns[idx];
        if (!alreadyCompleted && currentTurn) {
          // Fire-and-forget; errors shouldn't block the UI from advancing.
          void advanceTurn({
            courseId,
            lessonId,
            turnIndex: idx,
            xpAwarded: opts?.xp ?? currentTurn.xp_reward,
            source: opts?.source ?? `turn:${currentTurn.turn_type}`,
          });
        }
      }
      setRevealedCount((c) => Math.min(turns.length, c + 1));
    },
    [alreadyCompleted, courseId, lessonId, revealedCount, turns],
  );

  const active = turns[revealedCount - 1];
  const onLastTurn = revealedCount >= turns.length;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Header persona={persona} lessonTitle={lessonTitle} lessonSubtitle={lessonSubtitle} courseSlug={courseSlug} />

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-2xl px-5 py-6 flex flex-col gap-6">
          <ProgressBar current={revealedCount} total={turns.length} />

          <AnimatePresence initial={false}>
            {turns.slice(0, revealedCount).map((turn, i) => (
              <motion.div
                key={turn.id ?? i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: easeWarm }}
              >
                <TurnView
                  turn={turn}
                  persona={persona}
                  isActive={i === revealedCount - 1}
                  onContinue={goNext}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {onLastTurn && active?.turn_type === "checkpoint" ? (
            <CompleteCta
              courseId={courseId}
              lessonId={lessonId}
              lessonXpReward={lessonXpReward}
              alreadyCompleted={alreadyCompleted}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Header({
  persona, lessonTitle, lessonSubtitle, courseSlug,
}: {
  persona: Persona;
  lessonTitle: string;
  lessonSubtitle: string | null;
  courseSlug: string;
}) {
  return (
    <header className="sticky top-0 z-10 bg-paper-50/90 backdrop-blur border-b border-paper-200">
      <div className="mx-auto max-w-2xl px-5 py-3 flex items-center gap-3">
        <Link
          href={`/learn/${courseSlug}`}
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-paper-200 text-ink-700 hover:bg-paper-300 transition-colors"
          aria-label="Back to course"
        >
          <span aria-hidden>←</span>
        </Link>
        <TutorAvatar personaId={persona.id} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[15px] text-ink-900 truncate">{lessonTitle}</p>
          {lessonSubtitle ? (
            <p className="text-xs text-ink-500 italic font-serif truncate">{lessonSubtitle}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-[2px] rounded-full bg-paper-200 overflow-hidden">
        <motion.div
          className="h-full bg-ember-500"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.45, ease: easeWarm }}
        />
      </div>
      <span className="text-[11px] text-ink-500 font-tabular tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ Turn views */

function TurnView({
  turn, persona, isActive, onContinue,
}: {
  turn: LessonTurn;
  persona: Persona;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  switch (turn.turn_type) {
    case "tutor_message":
      return <TutorMessage turn={turn} persona={persona} />;
    case "mcq":
      return <McqBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "free_text":
    case "reflection":
    case "exercise":
      return <TextInputBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "ai_conversation":
      return <AiConversationBlock turn={turn} persona={persona} isActive={isActive} onContinue={onContinue} />;
    case "media":
      return <MediaBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "checkpoint":
      return <CheckpointBlock turn={turn} />;
  }
}

function TutorMessage({
  turn, persona,
}: { turn: Extract<LessonTurn, { turn_type: "tutor_message" }>; persona: Persona }) {
  const speaker = personaById(turn.content.persona_id ?? persona.id);
  const typingMs = turn.content.typing_ms ?? 1200;
  const [showText, setShowText] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowText(true), typingMs);
    return () => clearTimeout(t);
  }, [typingMs]);

  return (
    <div className="flex items-start gap-3">
      <TutorAvatar personaId={speaker.id} size="md" />
      <div className="max-w-[85%]">
        {!showText ? (
          <TypingDots />
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeWarm }}
            className="rounded-2xl rounded-tl-md bg-paper-100 border border-paper-200 px-4 py-3 font-serif text-[17px] leading-snug text-ink-900 whitespace-pre-line"
          >
            {turn.content.text}
          </motion.p>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-paper-100 border border-paper-200 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-400"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const selected = turn.content.options.find((o) => o.id === selectedId);
  const done = Boolean(selected?.is_correct);

  const pick = (id: string) => {
    if (done) return;
    const option = turn.content.options.find((o) => o.id === id);
    if (!option) return;
    if (option.is_correct) {
      setSelectedId(id);
      setWrongId(null);
    } else {
      setWrongId(id);
      setTimeout(() => setWrongId(null), 450);
    }
  };

  return (
    <div className="mt-1">
      <p className="font-serif text-[17px] text-ink-900">{turn.content.question}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {turn.content.options.map((o) => {
          const isSelected = selected?.id === o.id;
          const isWrong = wrongId === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={done && !isSelected}
                onClick={() => pick(o.id)}
                className={cn(
                  "w-full text-left rounded-2xl border px-4 py-3 flex items-start gap-3 transition-[border-color,background-color,transform,opacity] duration-220 ease-warm",
                  isSelected
                    ? "border-moss-400 bg-[#EEF2E3] shadow-paper"
                    : "border-paper-200 bg-paper-100 hover:border-ink-200 hover:-translate-y-[1px]",
                  done && !isSelected && "opacity-40",
                  isWrong && "animate-shake-x border-ember-400",
                )}
              >
                <span className="font-tabular text-xs uppercase pt-[3px] text-ink-500 w-4">{o.id}</span>
                <span className="flex-1">
                  <span className="font-serif text-[16px] text-ink-900">{o.text}</span>
                  {isSelected && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, ease: easeWarm }}
                      className="block mt-1 italic font-serif text-sm text-ink-600"
                    >
                      {o.rationale}
                    </motion.span>
                  ) : isWrong && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="block mt-1 italic font-serif text-sm text-ember-700"
                    >
                      {o.rationale}
                    </motion.span>
                  ) : null}
                </span>
                {isSelected ? <Check className="h-4 w-4 text-moss-500 mt-1 shrink-0" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {done && isActive ? (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() =>
              onContinue({
                xp: turn.xp_reward,
                source: "mcq",
              })
            }
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TextInputBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "free_text" | "reflection" | "exercise" }>;
  isActive: boolean;
  onContinue: (opts?: { xp?: number; source?: string }) => void;
}) {
  const isExercise = turn.turn_type === "exercise";
  const minChars =
    turn.turn_type === "free_text" ? (turn.content.min_chars ?? 10) : 1;
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= minChars;

  const prompt = turn.turn_type === "exercise" ? turn.content.instruction : turn.content.prompt;
  const placeholder =
    turn.turn_type === "exercise"
      ? turn.content.placeholder ?? "Paste here…"
      : turn.content.placeholder ?? "Write in your own words…";

  return (
    <div className="mt-1">
      {isExercise && turn.content.tool ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-ember-50 border border-ember-200 px-3 py-1 text-xs text-ember-700">
          <Sparkles className="h-3.5 w-3.5" />
          opens {turn.content.tool}
        </div>
      ) : null}
      <p className="font-serif text-[17px] text-ink-900 whitespace-pre-line">{prompt}</p>
      <textarea
        rows={isExercise ? 6 : 3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={!isActive}
        className="mt-3 w-full rounded-2xl border border-paper-200 bg-paper-100 px-4 py-3 outline-none focus:border-ember-500 transition-colors resize-none font-sans text-[15px]"
      />
      {isActive ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-500 font-tabular">
            {trimmed.length}/{minChars} chars
          </span>
          <Button
            onClick={() =>
              onContinue({ xp: turn.xp_reward, source: turn.turn_type })
            }
            disabled={!canSubmit}
          >
            Submit <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.shouldEnd) setEnded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  const finished = ended || userTurns >= cap;

  return (
    <div className="rounded-2xl border border-paper-200 bg-paper-100 p-4">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <Sparkles className="h-3.5 w-3.5 text-ember-500" />
        sub-chat with {persona.name} · max <span className="font-tabular">{cap}</span> turns · goal: {turn.content.goal}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} personaId={persona.id} />
        ))}
        {pending ? (
          <div className="flex items-start gap-3">
            <TutorAvatar personaId={persona.id} size="sm" />
            <TypingDots />
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-ember-700">{error}</p> : null}

      {!finished ? (
        <div className="mt-3 flex items-end gap-2">
          <textarea
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
            className="flex-1 rounded-2xl border border-paper-200 bg-paper-50 px-4 py-2.5 outline-none focus:border-ember-500 transition-colors resize-none font-sans text-[15px]"
          />
          <Button
            size="md"
            onClick={send}
            disabled={!isActive || pending || value.trim().length === 0}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : isActive ? (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={() =>
              onContinue({ xp: turn.xp_reward, source: "ai_conversation" })
            }
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Bubble({
  role, content, personaId,
}: { role: ChatMessage["role"]; content: string; personaId: Persona["id"] }) {
  if (role === "assistant") {
    return (
      <div className="flex items-start gap-3">
        <TutorAvatar personaId={personaId} size="sm" />
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-paper-50 border border-paper-200 px-4 py-2.5 font-serif text-[16px] leading-snug text-ink-900 whitespace-pre-line">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-ember-50 border border-ember-200 px-4 py-2.5 text-[16px] leading-snug text-ink-900 whitespace-pre-line">
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
  return (
    <div className="mt-1">
      {turn.content.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={turn.content.url}
          alt={turn.content.caption ?? ""}
          className="w-full rounded-2xl border border-paper-200"
          style={{ aspectRatio: turn.content.aspect_ratio }}
        />
      ) : (
        <video
          src={turn.content.url}
          controls
          className="w-full rounded-2xl border border-paper-200"
          style={{ aspectRatio: turn.content.aspect_ratio }}
        />
      )}
      {turn.content.caption ? (
        <p className="mt-2 italic font-serif text-sm text-ink-600">{turn.content.caption}</p>
      ) : null}
      {isActive ? (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "media" })}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CheckpointBlock({
  turn,
}: { turn: Extract<LessonTurn, { turn_type: "checkpoint" }> }) {
  return (
    <div className="rounded-3xl border border-ember-200 bg-ember-50 p-6 shadow-paper">
      <p className="eyebrow text-ember-700">checkpoint</p>
      <p className="mt-2 font-serif text-2xl text-ink-900">{turn.content.title}</p>
      <p className="mt-2 text-ink-700 leading-relaxed whitespace-pre-line">{turn.content.summary}</p>
    </div>
  );
}

function CompleteCta({
  courseId, lessonId, lessonXpReward, alreadyCompleted,
}: {
  courseId: string;
  lessonId: string;
  lessonXpReward: number;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [awarded, setAwarded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    start(async () => {
      try {
        const res = await completeLesson({ courseId, lessonId, lessonXpReward });
        setAwarded(res.awarded);
        router.push("/home");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  };

  if (awarded !== null) {
    return (
      <p className="text-center text-ink-600">
        Saved · <span className="font-tabular">+{awarded}</span> XP · streak bumped.
      </p>
    );
  }

  return (
    <div className="flex justify-center pb-4">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? "Saving…" : alreadyCompleted ? "Back to home" : `Complete lesson · +${lessonXpReward} XP`}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {error ? <span className="ml-3 text-sm text-ember-700 self-center">{error}</span> : null}
    </div>
  );
}
