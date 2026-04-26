"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, GripVertical, Sparkles } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { LessonTurn } from "@/lib/turns";
import { cn } from "@/lib/utils";

import { useLessonFx } from "./LessonFxContext";
import { continueLabel } from "./labels";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type Continue = (opts?: { xp?: number; source?: string }) => void;

// =====================================================================
// Fill in the blank
// =====================================================================

const BLANK_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

type Segment = { kind: "text"; value: string } | { kind: "blank"; id: string };

function parseTemplate(template: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of template.matchAll(BLANK_RE)) {
    if (m.index === undefined) continue;
    if (m.index > last) out.push({ kind: "text", value: template.slice(last, m.index) });
    out.push({ kind: "blank", id: m[1]! });
    last = m.index + m[0].length;
  }
  if (last < template.length) out.push({ kind: "text", value: template.slice(last) });
  return out;
}

function isAccepted(value: string, accepted: string[]) {
  const v = value.trim().toLowerCase();
  if (!v) return false;
  return accepted.some((a) => a.trim().toLowerCase() === v);
}

export function FillInTheBlankBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "fill_in_the_blank" }>;
  isActive: boolean;
  onContinue: Continue;
}) {
  const fx = useLessonFx();
  const segments = useMemo(() => parseTemplate(turn.content.template), [turn.content.template]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(turn.content.answers.map((a) => [a.id, ""])),
  );
  const [showHint, setShowHint] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const xpAwardedRef = useRef(false);

  const allFilled = turn.content.answers.every((a) => values[a.id]?.trim().length);

  const check = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (done) return;
    const wrong = turn.content.answers.find((a) => !isAccepted(values[a.id] ?? "", a.accepted));
    if (!wrong) {
      setDone(true);
      fx.play("correct");
      fx.haptic.success();
      fx.bumpStreak(true);
      if (!xpAwardedRef.current) {
        xpAwardedRef.current = true;
        const rect = ev.currentTarget.getBoundingClientRect();
        fx.addXp(turn.xp_reward, rect);
      }
      return;
    }
    setShakeId(wrong.id);
    setShowHint(true);
    setTimeout(() => setShakeId(null), 320);
    fx.play("wrong");
    fx.haptic.error();
    fx.bumpStreak(false);
  };

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>fill in the blanks</p>
      <h2
        className="lm-serif"
        style={{ fontSize: 24, lineHeight: 1.2, color: "var(--text)" }}
      >
        {turn.content.prompt}
      </h2>

      <div
        className="lm-card lm-serif"
        style={{
          marginTop: 20,
          padding: 20,
          fontSize: 20,
          lineHeight: 1.6,
          color: "var(--text)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          rowGap: 8,
        }}
      >
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <span key={i} style={{ whiteSpace: "pre-wrap" }}>
                {seg.value}
              </span>
            );
          }
          const isCorrect = done && isAccepted(values[seg.id] ?? "", findAccepted(turn, seg.id));
          return (
            <input
              key={i}
              type="text"
              value={values[seg.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [seg.id]: e.target.value }))}
              disabled={!isActive || done}
              aria-label={`Blank ${seg.id}`}
              className={cn(
                "lm-blank",
                isCorrect && "lm-blank--correct",
                shakeId === seg.id && "lm-blank--wrong lm-shake",
              )}
              size={Math.max(6, (values[seg.id]?.length ?? 0) + 2)}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {showHint && turn.content.hint && !done ? (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            style={{ marginTop: 12, fontSize: 13, color: "var(--text-3)" }}
          >
            <span
              className="lm-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--saffron-deep)",
                marginRight: 8,
              }}
            >
              hint
            </span>
            {turn.content.hint}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {isActive ? (
        <div className="flex items-center" style={{ gap: 8, marginTop: 24 }}>
          {!done ? (
            <button
              type="button"
              className="lm-btn lm-btn--ghost lm-btn--sm"
              onClick={() => onContinue({ xp: 0, source: "skip:fill_in_the_blank" })}
              style={{ color: "var(--text-3)" }}
            >
              Skip
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          {!done ? (
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={check}
              disabled={!allFilled}
            >
              Check <Check className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "fill_in_the_blank" })}
            >
              {continueLabel("fill_in_the_blank", turn.id)} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function findAccepted(
  turn: Extract<LessonTurn, { turn_type: "fill_in_the_blank" }>,
  id: string,
): string[] {
  return turn.content.answers.find((a) => a.id === id)?.accepted ?? [];
}

// =====================================================================
// Drag to reorder
// =====================================================================

/** Deterministic Fisher-Yates shuffle keyed off the turn id, so the same turn
 *  always presents the items in the same order — no jitter on re-render. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.every((x, i) => x === arr[i]) && out.length >= 2) {
    [out[0], out[1]] = [out[1]!, out[0]!];
  }
  return out;
}

export function DragToReorderBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "drag_to_reorder" }>;
  isActive: boolean;
  onContinue: Continue;
}) {
  const fx = useLessonFx();
  const initial = useMemo(
    () => seededShuffle(turn.content.items.map((i) => i.id), turn.id),
    [turn.content.items, turn.id],
  );
  const [order, setOrder] = useState<string[]>(initial);
  const [done, setDone] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const xpAwardedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelFor = (id: string) =>
    turn.content.items.find((i) => i.id === id)?.label ?? id;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
    fx.haptic.tap();
  };

  const check = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (done) return;
    const correct = turn.content.correct_order;
    const ok = order.length === correct.length && order.every((id, i) => id === correct[i]);
    if (ok) {
      setDone(true);
      fx.play("correct");
      fx.haptic.success();
      fx.bumpStreak(true);
      if (!xpAwardedRef.current) {
        xpAwardedRef.current = true;
        fx.addXp(turn.xp_reward, ev.currentTarget.getBoundingClientRect());
      }
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 320);
      fx.play("wrong");
      fx.haptic.error();
      fx.bumpStreak(false);
    }
  };

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>put these in order</p>
      <h2
        className="lm-serif"
        style={{ fontSize: 24, lineHeight: 1.2, color: "var(--text)" }}
      >
        {turn.content.prompt}
      </h2>

      <div className={cn(wrongFlash && "lm-shake")} style={{ marginTop: 20 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col" style={{ gap: 8 }}>
              {order.map((id, i) => (
                <SortableRow
                  key={id}
                  id={id}
                  index={i}
                  label={labelFor(id)}
                  done={done}
                  disabled={!isActive || done}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      {isActive ? (
        <div className="flex items-center" style={{ gap: 8, marginTop: 24 }}>
          {!done ? (
            <button
              type="button"
              className="lm-btn lm-btn--ghost lm-btn--sm"
              onClick={() => onContinue({ xp: 0, source: "skip:drag_to_reorder" })}
              style={{ color: "var(--text-3)" }}
            >
              Skip
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          {!done ? (
            <button type="button" className="lm-btn lm-btn--accent" onClick={check}>
              Check order <Check className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "drag_to_reorder" })}
            >
              {continueLabel("drag_to_reorder", turn.id)} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SortableRow({
  id, index, label, done, disabled,
}: {
  id: string;
  index: number;
  label: string;
  done: boolean;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    boxShadow: isDragging ? "var(--shadow-2)" : undefined,
    userSelect: "none",
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn("lm-reorder", done && "lm-reorder--correct")}
    >
      <span
        className="lm-mono lm-tabular"
        style={{ width: 20, fontSize: 12, color: "var(--text-4)" }}
      >
        {index + 1}
      </span>
      <span style={{ flex: 1, fontSize: 15, color: "var(--text)" }}>{label}</span>
      <button
        type="button"
        aria-label={`Drag ${label}`}
        disabled={disabled}
        className="lm-reorder__handle"
        style={disabled ? { opacity: 0.4, cursor: "default" } : undefined}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </li>
  );
}

// =====================================================================
// Tap to match
// =====================================================================

type PairState = { leftId: string; rightId: string; status: "ok" };

export function TapToMatchBlock({
  turn, isActive, onContinue,
}: {
  turn: Extract<LessonTurn, { turn_type: "tap_to_match" }>;
  isActive: boolean;
  onContinue: Continue;
}) {
  const fx = useLessonFx();
  const [pendingLeft, setPendingLeft] = useState<string | null>(null);
  const [pendingRight, setPendingRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<PairState[]>([]);
  const [wrongPair, setWrongPair] = useState<{ left?: string; right?: string } | null>(null);
  const xpAwardedRef = useRef(false);

  // Shuffle the right column so the puzzle isn't trivially "match top-to-
  // top". Authors write `right` in the same order as `pairs`, which lines
  // up with `left` 1:1 — without this, the user just clicks down both
  // columns. Left stays in authored order (typically meaningful, e.g.
  // RTCC). seededShuffle is keyed off turn.id so the same turn always
  // presents the same shuffled order — no jitter on re-render or revisit.
  const shuffledRight = useMemo(
    () => seededShuffle(turn.content.right, turn.id),
    [turn.content.right, turn.id],
  );

  const isCorrectPair = (l: string, r: string) =>
    turn.content.pairs.some(([pl, pr]) => pl === l && pr === r);

  const lockedLeft = (id: string) => matched.some((m) => m.leftId === id);
  const lockedRight = (id: string) => matched.some((m) => m.rightId === id);

  const tryComplete = (leftId: string, rightId: string, ev: React.MouseEvent) => {
    if (isCorrectPair(leftId, rightId)) {
      const next: PairState[] = [...matched, { leftId, rightId, status: "ok" }];
      setMatched(next);
      setPendingLeft(null);
      setPendingRight(null);
      fx.play("correct");
      fx.haptic.success();
      fx.bumpStreak(true);
      if (next.length === turn.content.pairs.length && !xpAwardedRef.current) {
        xpAwardedRef.current = true;
        fx.addXp(turn.xp_reward, ev.currentTarget.getBoundingClientRect());
      }
    } else {
      setWrongPair({ left: leftId, right: rightId });
      setTimeout(() => {
        setWrongPair(null);
        setPendingLeft(null);
        setPendingRight(null);
      }, 360);
      fx.play("wrong");
      fx.haptic.error();
      fx.bumpStreak(false);
    }
  };

  const tapLeft = (id: string, ev: React.MouseEvent) => {
    if (!isActive || lockedLeft(id)) return;
    if (pendingRight) {
      tryComplete(id, pendingRight, ev);
      return;
    }
    setPendingLeft((p) => (p === id ? null : id));
    fx.haptic.tap();
  };
  const tapRight = (id: string, ev: React.MouseEvent) => {
    if (!isActive || lockedRight(id)) return;
    if (pendingLeft) {
      tryComplete(pendingLeft, id, ev);
      return;
    }
    setPendingRight((p) => (p === id ? null : id));
    fx.haptic.tap();
  };

  const allDone = matched.length === turn.content.pairs.length;

  const cellClass = (opts: {
    locked: boolean;
    pending: boolean;
    wrong: boolean;
    disabled: boolean;
  }) =>
    cn(
      "lm-option",
      opts.locked && "lm-option--correct",
      opts.pending && "lm-option--pending",
      opts.wrong && "lm-option--wrong lm-shake",
      opts.disabled && !opts.locked && "lm-option--dim",
    );

  return (
    <div>
      <p className="lm-eyebrow" style={{ marginBottom: 8 }}>match the pairs</p>
      <h2
        className="lm-serif"
        style={{ fontSize: 24, lineHeight: 1.2, color: "var(--text)" }}
      >
        {turn.content.prompt}
      </h2>

      <div
        className="grid grid-cols-2"
        style={{ gap: 12, marginTop: 20 }}
      >
        <ul className="flex flex-col" style={{ gap: 8 }}>
          {turn.content.left.map((it) => {
            const locked = lockedLeft(it.id);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  disabled={!isActive || locked}
                  onClick={(ev) => tapLeft(it.id, ev)}
                  className={cellClass({
                    locked,
                    pending: pendingLeft === it.id,
                    wrong: wrongPair?.left === it.id,
                    disabled: !isActive,
                  })}
                >
                  <span className="flex items-center" style={{ gap: 8 }}>
                    {locked ? (
                      <Check className="h-4 w-4" style={{ color: "var(--moss)" }} />
                    ) : null}
                    <span>{it.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="flex flex-col" style={{ gap: 8 }}>
          {shuffledRight.map((it) => {
            const locked = lockedRight(it.id);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  disabled={!isActive || locked}
                  onClick={(ev) => tapRight(it.id, ev)}
                  className={cellClass({
                    locked,
                    pending: pendingRight === it.id,
                    wrong: wrongPair?.right === it.id,
                    disabled: !isActive,
                  })}
                >
                  <span className="flex items-center" style={{ gap: 8 }}>
                    {locked ? (
                      <Check className="h-4 w-4" style={{ color: "var(--moss)" }} />
                    ) : null}
                    <span>{it.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {allDone ? (
        <div
          className="inline-flex items-center"
          style={{ gap: 6, marginTop: 16, color: "var(--moss-deep)", fontSize: 14 }}
        >
          <Sparkles className="h-4 w-4" /> All pairs matched.
        </div>
      ) : null}

      {isActive ? (
        <div className="flex items-center" style={{ marginTop: 16, gap: 8 }}>
          {!allDone ? (
            <button
              type="button"
              className="lm-btn lm-btn--ghost lm-btn--sm"
              onClick={() => onContinue({ xp: 0, source: "skip:tap_to_match" })}
              style={{ color: "var(--text-3)" }}
            >
              Skip
            </button>
          ) : null}
          <div style={{ flex: 1 }} />
          {allDone ? (
            <button
              type="button"
              className="lm-btn lm-btn--accent"
              onClick={() => onContinue({ xp: turn.xp_reward, source: "tap_to_match" })}
            >
              {continueLabel("tap_to_match", turn.id)} <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
