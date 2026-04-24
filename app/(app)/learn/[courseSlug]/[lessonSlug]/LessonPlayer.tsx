"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, MessagesSquare, Send } from "lucide-react";

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

// Tools for which we keep the user inside the app by running a Claude-backed
// practice chat, instead of launching an external tab.
const IN_APP_TOOLS = new Set(["chatgpt", "claude", "gemini", "perplexity"]);

export function LessonPlayer(props: Props) {
  const {
    courseSlug, lessonTitle, lessonSubtitle, lessonXpReward,
    courseId, lessonId, turns, personaId,
    initialTurnIndex, alreadyCompleted,
  } = props;

  const persona = useMemo(() => personaById(personaId), [personaId]);

  const safeInitial = Math.min(Math.max(0, initialTurnIndex), turns.length - 1);
  const [revealedCount, setRevealedCount] = useState(safeInitial + 1);

  const scrollerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [revealedCount]);

  // Tutor messages have no "continue" affordance — auto-advance after the
  // typing-indicator delay, regardless of what comes next. Without this,
  // the lesson deadlocks on any `tutor_message → <interactive turn>` boundary.
  useEffect(() => {
    const idx = revealedCount - 1;
    if (idx < 0 || idx >= turns.length) return;
    const turn = turns[idx];
    if (!turn || turn.turn_type !== "tutor_message") return;
    if (idx + 1 >= turns.length) return;

    const delay = Math.max(500, (turn.content.typing_ms ?? 1000) + 300);
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

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-5 flex flex-col gap-5">
          <ProgressBar current={revealedCount} total={turns.length} />

          <AnimatePresence initial={false}>
            {turns.slice(0, revealedCount).map((turn, i) => (
              <motion.div
                key={turn.id ?? i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
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
    <header className="sticky top-0 z-10 bg-white border-b border-ink-200">
      <div className="mx-auto max-w-2xl px-5 py-3 flex items-center gap-3">
        <Link
          href={`/learn/${courseSlug}`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition-colors duration-150 ease-out"
          aria-label="Back to course"
        >
          <span aria-hidden>←</span>
        </Link>
        <TutorAvatar personaId={persona.id} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink-900 truncate">{lessonTitle}</p>
          {lessonSubtitle ? (
            <p className="text-xs text-ink-500 truncate">{lessonSubtitle}</p>
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
      <div className="flex-1 h-[3px] rounded-sm bg-ink-100 overflow-hidden">
        <motion.div
          className="h-full bg-accent-600"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
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
      return <TextInputBlock turn={turn} isActive={isActive} onContinue={onContinue} />;
    case "exercise":
      return <ExerciseBlock turn={turn} persona={persona} isActive={isActive} onContinue={onContinue} />;
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
  const typingMs = turn.content.typing_ms ?? 1000;
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
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-lg bg-white border border-ink-200 px-4 py-3 text-[15px] leading-relaxed text-ink-900 whitespace-pre-line"
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
    <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-ink-200 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-400"
          animate={{ opacity: [0.25, 1, 0.25] }}
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
      setTimeout(() => setWrongId(null), 280);
    }
  };

  return (
    <div>
      <p className="text-[16px] font-semibold text-ink-900">{turn.content.question}</p>
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
                  "w-full text-left rounded-md border px-4 py-3 flex items-start gap-3 transition-[border-color,background-color,opacity] duration-150 ease-out",
                  isSelected
                    ? "border-success-600 bg-success-50"
                    : "border-ink-200 bg-white hover:border-ink-300",
                  done && !isSelected && "opacity-40",
                  isWrong && "animate-shake-x border-danger-500 bg-danger-50",
                )}
              >
                <span className="font-mono text-xs font-semibold uppercase pt-[3px] text-ink-400 w-4 tabular-nums">
                  {o.id}
                </span>
                <span className="flex-1">
                  <span className="text-[15px] text-ink-900">{o.text}</span>
                  {isSelected && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="block mt-1.5 text-sm text-ink-700"
                    >
                      {o.rationale}
                    </motion.span>
                  ) : isWrong && o.rationale ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="block mt-1.5 text-sm text-danger-700"
                    >
                      {o.rationale}
                    </motion.span>
                  ) : null}
                </span>
                {isSelected ? <Check className="h-4 w-4 text-success-600 mt-1 shrink-0" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {done && isActive ? (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "mcq" })}>
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
      <p className="text-[16px] font-semibold text-ink-900">{turn.content.prompt}</p>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={turn.content.placeholder ?? "Write in your own words…"}
        disabled={!isActive}
        className="mt-3 w-full rounded-md border border-ink-300 bg-white px-3 py-2.5 outline-none focus:border-accent-600 transition-colors duration-150 ease-out resize-none text-[15px]"
      />
      {isActive ? (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-ink-500 font-tabular tabular-nums">
            {trimmed.length}/{minChars} chars
          </span>
          <Button
            onClick={() => onContinue({ xp: turn.xp_reward, source: turn.turn_type })}
            disabled={!canSubmit}
          >
            Submit <ArrowRight className="h-4 w-4" />
          </Button>
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
  // Kept for exercises like midjourney / canva / runway where the user
  // actually needs to be in that other surface.
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 1;

  return (
    <div>
      {turn.content.tool ? (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-ink-100 border border-ink-200 px-2.5 py-1 text-xs text-ink-700">
          opens {turn.content.tool}
        </div>
      ) : null}
      <p className="text-[16px] font-semibold text-ink-900 whitespace-pre-line">
        {turn.content.instruction}
      </p>
      <textarea
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={turn.content.placeholder ?? "Paste here…"}
        disabled={!isActive}
        className="mt-3 w-full rounded-md border border-ink-300 bg-white px-3 py-2.5 outline-none focus:border-accent-600 transition-colors duration-150 ease-out resize-none text-[15px]"
      />
      {isActive ? (
        <div className="mt-3 flex justify-end">
          <Button
            onClick={() => onContinue({ xp: turn.xp_reward, source: "exercise" })}
            disabled={!canSubmit}
          >
            Submit <ArrowRight className="h-4 w-4" />
          </Button>
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
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setPending(false);
    }
  };

  const canFinish = messages.some((m) => m.role === "user");

  return (
    <div className="rounded-lg border border-ink-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-ink-50 border-b border-ink-200">
        <MessagesSquare className="h-4 w-4 text-accent-600" />
        <p className="text-xs font-medium text-ink-700">
          practice sandbox{turn.content.tool ? ` · ${turn.content.tool}-style` : ""}
        </p>
      </div>

      <div className="p-4">
        <p className="text-[15px] leading-relaxed text-ink-900 whitespace-pre-line">
          {turn.content.instruction}
        </p>

        {messages.length > 0 || pending ? (
          <div className="mt-4 flex flex-col gap-2">
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} content={m.content} personaId={persona.id} />
            ))}
            {pending ? (
              <div className="flex items-start gap-2">
                <TutorAvatar personaId={persona.id} size="sm" />
                <TypingDots />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="mt-2 text-xs text-danger-600">{error}</p> : null}

        {isActive ? (
          <div className="mt-4 flex items-end gap-2">
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
              placeholder="Type your prompt…"
              disabled={pending}
              className="flex-1 rounded-md border border-ink-300 bg-white px-3 py-2 outline-none focus:border-accent-600 transition-colors duration-150 ease-out resize-none text-[15px]"
            />
            <Button size="md" onClick={send} disabled={pending || value.trim().length === 0}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {isActive && canFinish ? (
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "exercise_practice" })}
            >
              Done — I've had enough practice <ArrowRight className="h-4 w-4" />
            </Button>
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
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-ink-500">
        <MessagesSquare className="h-3.5 w-3.5 text-accent-600" />
        sub-chat with {persona.name} · max <span className="font-tabular tabular-nums">{cap}</span> turns
      </div>

      <p className="mt-2 text-xs text-ink-500">Goal: {turn.content.goal}</p>

      <div className="mt-3 flex flex-col gap-2">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} personaId={persona.id} />
        ))}
        {pending ? (
          <div className="flex items-start gap-2">
            <TutorAvatar personaId={persona.id} size="sm" />
            <TypingDots />
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-danger-600">{error}</p> : null}

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
            className="flex-1 rounded-md border border-ink-300 bg-white px-3 py-2 outline-none focus:border-accent-600 transition-colors duration-150 ease-out resize-none text-[15px]"
          />
          <Button size="md" onClick={send} disabled={!isActive || pending || value.trim().length === 0}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      ) : isActive ? (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "ai_conversation" })}>
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
      <div className="flex items-start gap-2">
        <TutorAvatar personaId={personaId} size="sm" />
        <div className="max-w-[85%] rounded-md bg-ink-50 border border-ink-200 px-3 py-2 text-[15px] leading-relaxed text-ink-900 whitespace-pre-line">
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 justify-end">
      <div className="max-w-[85%] rounded-md bg-accent-600 text-white px-3 py-2 text-[15px] leading-relaxed whitespace-pre-line">
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
    <div>
      {turn.content.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={turn.content.url}
          alt={turn.content.caption ?? ""}
          className="w-full rounded-lg border border-ink-200"
          style={{ aspectRatio: turn.content.aspect_ratio }}
        />
      ) : (
        <video
          src={turn.content.url}
          controls
          className="w-full rounded-lg border border-ink-200"
          style={{ aspectRatio: turn.content.aspect_ratio }}
        />
      )}
      {turn.content.caption ? (
        <p className="mt-2 text-sm text-ink-600">{turn.content.caption}</p>
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
    <div className="rounded-lg border border-accent-200 bg-accent-50 p-5">
      <p className="eyebrow text-accent-700">checkpoint</p>
      <p className="mt-1.5 font-bold text-xl text-ink-900">{turn.content.title}</p>
      <p className="mt-2 text-ink-800 leading-relaxed whitespace-pre-line">{turn.content.summary}</p>
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
      <p className="text-center text-ink-600 text-sm">
        Saved · <span className="font-tabular tabular-nums">+{awarded}</span> XP · streak bumped.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 pb-4">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending
          ? "Saving…"
          : alreadyCompleted
            ? "Back to home"
            : `Complete lesson · +${lessonXpReward} XP`}
        <ArrowRight className="h-4 w-4" />
      </Button>
      {error ? <span className="text-sm text-danger-600">{error}</span> : null}
    </div>
  );
}
