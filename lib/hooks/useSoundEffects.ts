"use client";

import { useCallback, useEffect, useRef } from "react";

type SfxName = "correct" | "wrong" | "celebrate";

/** Synthesises short SFX with the Web Audio API — no network requests, no
 *  embedded blobs. Each sound is a shaped sine envelope, kept tiny and
 *  pleasant rather than game-y.
 *
 *  Gated by the caller so the same audio toggle that governs narration also
 *  governs SFX (one switch, everything). Passing `enabled=false` makes every
 *  `play()` a no-op and stops any in-flight oscillator. */
export function useSoundEffects(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const W = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = W.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    return ctxRef.current;
  }, []);

  // Close the context on unmount to free the audio graph.
  useEffect(() => {
    return () => {
      try { ctxRef.current?.close(); } catch { /* ignore */ }
      ctxRef.current = null;
    };
  }, []);

  const tone = useCallback(
    (ctx: AudioContext, freq: number, startAt: number, durationMs: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startAt);

      const attack = 0.008;
      const durS = durationMs / 1000;
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durS);

      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + durS + 0.02);
    },
    [],
  );

  const play = useCallback(
    (name: SfxName) => {
      if (!enabled) return;
      const ctx = getCtx();
      if (!ctx) return;
      // Some browsers suspend the context until a user gesture — resume first.
      if (ctx.state === "suspended") ctx.resume().catch(() => { /* ignore */ });

      const t0 = ctx.currentTime + 0.01;
      const VOL = 0.12;

      if (name === "correct") {
        // Cheerful rising fifth: C5 → G5.
        tone(ctx, 523.25, t0,         90, VOL);
        tone(ctx, 783.99, t0 + 0.085, 140, VOL);
      } else if (name === "wrong") {
        // Soft descending minor third: A4 → F4.
        tone(ctx, 440.0, t0,         120, VOL * 0.9);
        tone(ctx, 349.23, t0 + 0.09, 180, VOL * 0.7);
      } else {
        // Celebration: major arpeggio C5 – E5 – G5 – C6.
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          tone(ctx, f, t0 + i * 0.09, 160, VOL);
        });
      }
    },
    [enabled, getCtx, tone],
  );

  return { play };
}
