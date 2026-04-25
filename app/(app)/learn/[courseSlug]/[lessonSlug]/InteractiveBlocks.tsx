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

import { Button } from "@/components/ui/Button";
import type { LessonTurn } from "@/lib/turns";
import { cn } from "@/lib/utils";

import { useLessonFx } from "./LessonFxContext";

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
      <p className="text-[16px] font-semibold text-ink-900">{turn.content.prompt}</p>
      <div className="mt-3 rounded-md border border-ink-200 bg-white p-4 text-[15px] leading-relaxed text-ink-900 flex flex-wrap items-center gap-y-2">
        {segments.map((seg, i) => {
          if (seg.kind === "text") {
            return (
              <span key={i} className="whitespace-pre-wrap">
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
                "mx-1 inline-block min-w-[5ch] max-w-[14ch] rounded border-b-2 bg-transparent px-1 py-0.5 outline-none text-ink-900 transition-colors duration-150 ease-out",
                isCorrect
                  ? "border-success-600 bg-success-50"
                  : shakeId === seg.id
                    ? "border-danger-500 bg-danger-50 animate-shake-x"
                    : "border-ink-300 focus:border-accent-600",
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
            className="mt-2 text-sm text-ink-600"
          >
            <span className="font-medium text-ink-700">hint · </span>
            {turn.content.hint}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {isActive ? (
        <div className="mt-4 flex justify-end gap-2">
          {!done ? (
            <Button onClick={check} disabled={!allFilled}>
              Check <Check className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "fill_in_the_blank" })}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
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
  // If we somehow got the original order, swap two so it doesn't look static.
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
      <p className="text-[16px] font-semibold text-ink-900">{turn.content.prompt}</p>

      <div className={cn("mt-3", wrongFlash && "animate-shake-x")}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
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
        <div className="mt-4 flex justify-end gap-2">
          {!done ? (
            <Button onClick={check}>
              Check order <Check className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "drag_to_reorder" })}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border bg-white px-3 py-3 select-none transition-colors duration-150 ease-out",
        done ? "border-success-600 bg-success-50" : "border-ink-200",
        isDragging && "shadow-md",
      )}
    >
      <span className="font-mono text-xs text-ink-400 w-5 tabular-nums">{index + 1}</span>
      <span className="flex-1 text-[15px] text-ink-900">{label}</span>
      <button
        type="button"
        aria-label={`Drag ${label}`}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100 cursor-grab active:cursor-grabbing",
          disabled && "opacity-40 cursor-default",
        )}
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
      "w-full text-left rounded-md border px-3 py-2.5 text-[15px] transition-[border-color,background-color,opacity] duration-150 ease-out",
      opts.locked
        ? "border-success-600 bg-success-50 text-ink-700"
        : opts.pending
          ? "border-accent-600 bg-accent-50"
          : "border-ink-200 bg-white hover:border-ink-300",
      opts.wrong && "animate-shake-x border-danger-500 bg-danger-50",
      opts.disabled && !opts.locked && "opacity-40 cursor-default",
    );

  return (
    <div>
      <p className="text-[16px] font-semibold text-ink-900">{turn.content.prompt}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ul className="flex flex-col gap-2">
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
                  <span className="flex items-center gap-2">
                    {locked ? <Check className="h-4 w-4 text-success-600" /> : null}
                    <span>{it.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="flex flex-col gap-2">
          {turn.content.right.map((it) => {
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
                  <span className="flex items-center gap-2">
                    {locked ? <Check className="h-4 w-4 text-success-600" /> : null}
                    <span>{it.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {allDone ? (
        <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-success-700">
          <Sparkles className="h-4 w-4" /> All pairs matched.
        </div>
      ) : null}

      {isActive && allDone ? (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => onContinue({ xp: turn.xp_reward, source: "tap_to_match" })}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
