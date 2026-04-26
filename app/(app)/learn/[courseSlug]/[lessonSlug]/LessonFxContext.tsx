"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";

import { useHaptics } from "@/lib/hooks/useHaptics";
import { useSoundEffects } from "@/lib/hooks/useSoundEffects";

type SfxKind = "correct" | "wrong" | "celebrate";

type Haptics = ReturnType<typeof useHaptics>;

type FxValue = {
  /** Play a synthesised SFX. No-op when audio narration is off. */
  play: (kind: SfxKind) => void;
  /** Mobile haptic feedback. No-op on devices without vibrate(). */
  haptic: Haptics;
  /** Award XP — fires the flying-chip animation and bumps the header counter. */
  addXp: (amount: number, originRect?: DOMRect) => void;
  /** Bump the lesson-local correct-streak chip. Pass `false` to reset to 0. */
  bumpStreak: (correct: boolean) => void;
  /** Throw a celebratory confetti burst (cobalt + white). Run once at completion. */
  celebrate: () => void;
};

const FxContext = createContext<FxValue | null>(null);

export function useLessonFx(): FxValue {
  const ctx = useContext(FxContext);
  if (!ctx) {
    // Fail soft outside a provider — turn renderers can be tested in isolation.
    const noop = () => {};
    return {
      play: noop,
      haptic: { tap: noop, success: noop, error: noop },
      addXp: noop,
      bumpStreak: noop,
      celebrate: noop,
    };
  }
  return ctx;
}

type FlyingChip = { id: number; xp: number; from: { x: number; y: number } };

type ProviderProps = {
  /** Whether sound is enabled (mirrors the audio-narration toggle). */
  audioEnabled: boolean;
  /** Ref to the header XP chip — flying chips home in on its bounding box. */
  xpTargetRef: RefObject<HTMLDivElement | null>;
  /** Called when a flying chip lands; lets the parent increment the displayed XP. */
  onXpLanded: (amount: number) => void;
  /** Called when streak should bump or reset. */
  onStreakChange: (correct: boolean) => void;
  children: ReactNode;
};

export function LessonFxProvider({
  audioEnabled, xpTargetRef, onXpLanded, onStreakChange, children,
}: ProviderProps) {
  const { play } = useSoundEffects(audioEnabled);
  const haptic = useHaptics();
  const [chips, setChips] = useState<FlyingChip[]>([]);
  const nextIdRef = useRef(1);

  const addXp = useCallback((amount: number, originRect?: DOMRect) => {
    if (amount <= 0) return;
    const x = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
    const y = originRect ? originRect.top + originRect.height / 2 : window.innerHeight * 0.6;
    const id = nextIdRef.current++;
    setChips((prev) => [...prev, { id, xp: amount, from: { x, y } }]);
  }, []);

  const removeChip = useCallback((id: number, xp: number) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
    onXpLanded(xp);
  }, [onXpLanded]);

  const bumpStreak = useCallback((correct: boolean) => {
    onStreakChange(correct);
  }, [onStreakChange]);

  const celebrate = useCallback(() => {
    // Two short bursts from slightly off-centre — feels less robotic than one.
    const colors = ["#1f4ed8", "#3b82f6", "#ffffff", "#a3c4ff"];
    confetti({ particleCount: 36, spread: 70, startVelocity: 38, origin: { x: 0.4, y: 0.7 }, colors, scalar: 0.9 });
    confetti({ particleCount: 36, spread: 70, startVelocity: 38, origin: { x: 0.6, y: 0.7 }, colors, scalar: 0.9 });
  }, []);

  const value = useMemo<FxValue>(
    () => ({ play, haptic, addXp, bumpStreak, celebrate }),
    [play, haptic, addXp, bumpStreak, celebrate],
  );

  return (
    <FxContext.Provider value={value}>
      {children}
      <FlyingChipLayer chips={chips} targetRef={xpTargetRef} onLanded={removeChip} />
    </FxContext.Provider>
  );
}

function FlyingChipLayer({
  chips, targetRef, onLanded,
}: {
  chips: FlyingChip[];
  targetRef: RefObject<HTMLDivElement | null>;
  onLanded: (id: number, xp: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {chips.map((c) => {
          const target = targetRef.current?.getBoundingClientRect();
          // If we don't have a target yet, fly to a sensible top-right fallback.
          const tx = target ? target.left + target.width / 2 : window.innerWidth - 80;
          const ty = target ? target.top + target.height / 2 : 28;
          const dx = tx - c.from.x;
          const dy = ty - c.from.y;
          return (
            <motion.div
              key={c.id}
              className="absolute font-tabular tabular-nums text-[13px] font-semibold text-accent-700 bg-white border border-accent-200 rounded-full px-2.5 py-1 shadow-sm"
              style={{ left: c.from.x, top: c.from.y, translateX: "-50%", translateY: "-50%" }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.6, 1.1, 1, 0.7],
                x: [0, dx * 0.25, dx],
                y: [0, dy * 0.2 - 40, dy],
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], times: [0, 0.15, 0.6, 1] }}
              onAnimationComplete={() => onLanded(c.id, c.xp)}
            >
              +{c.xp} XP
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
