"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "ais_audio_enabled";

// Voice preference list — the first match wins. Tuned for clear English
// narration on macOS, iOS, Android Chrome, and desktop Chrome/Edge.
const PREFERRED_VOICE_NAMES = [
  "Samantha",
  "Google US English",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural) - English (United States)",
];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  for (const name of PREFERRED_VOICE_NAMES) {
    const match = voices.find((v) => v.name === name);
    if (match) return match;
  }
  const enUs = voices.find((v) => v.lang === "en-US");
  if (enUs) return enUs;
  const en = voices.find((v) => v.lang.startsWith("en"));
  return en ?? voices[0] ?? null;
}

/** Pronunciation overrides — TTS engines mangle initialisms ("ChatGPT" →
 *  "chatjeept", "GPT" → "guppet"). Spell them out instead. Order matters:
 *  longer / more specific entries first so "ChatGPT" runs before "GPT". */
const PRONUNCIATIONS: [RegExp, string][] = [
  [/\bChatGPT\b/gi, "Chat G P T"],
  [/\bGPT\b/g,      "G P T"],
  [/\bRTCC\b/g,     "R T C C"],
  [/\bLLM\b/g,      "L L M"],
  [/\bNLP\b/g,      "N L P"],
  [/\bAPI\b/g,      "A P I"],
  [/\bURL\b/g,      "U R L"],
  [/\bAI\b/g,       "A I"],
];

/** Pre-process lesson text for SpeechSynthesis. Three jobs:
 *  1. Strip markdown formatting characters that get read literally
 *     ("*important*" comes out as "asterisk important asterisk").
 *  2. Spell out initialisms via PRONUNCIATIONS so brand names sound right.
 *  3. Replace em/en dashes with a comma so the voice produces a natural
 *     pause instead of either ignoring them or saying "dash".
 *  All other punctuation is left alone — TTS engines handle commas,
 *  periods, and question marks correctly out of the box. */
function humanizeForSpeech(text: string): string {
  let out = text.replace(/[*_~`#]+/g, "");
  out = out.replace(/[—–]/g, ", ");
  for (const [re, replacement] of PRONUNCIATIONS) {
    out = out.replace(re, replacement);
  }
  return out;
}

type SpeakOptions = {
  /** Dedupe key — speak(text, key) is a no-op on subsequent calls with the same key. */
  key?: string;
  /** Fired when this utterance finishes naturally (not when cancelled). */
  onEnd?: () => void;
};

export type AudioNarration = {
  enabled: boolean;
  speaking: boolean;
  toggle: () => void;
  setEnabled: (on: boolean) => void;
  speak: (text: string, opts?: SpeakOptions) => void;
  cancel: () => void;
};

/** Thin wrapper around SpeechSynthesis with enable/disable persisted to
 *  localStorage. Safe to call on the server (it no-ops); the state hydrates
 *  once the client mounts. */
export function useAudioNarration(): AudioNarration {
  const [enabled, setEnabledState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const spokenKeysRef = useRef<Set<string>>(new Set());
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setEnabledState(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Keep voice list fresh — some browsers load voices asynchronously.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const refresh = () => {
      voiceRef.current = pickVoice(window.speechSynthesis.getVoices());
    };
    refresh();
    window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", refresh);
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
        }
      } catch {
        /* ignore */
      }
      if (!on) cancel();
    },
    [cancel],
  );

  const toggle = useCallback(() => setEnabled(!enabled), [enabled, setEnabled]);

  const speak = useCallback(
    (text: string, opts?: SpeakOptions) => {
      if (!enabled) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      if (!text || !text.trim()) return;

      if (opts?.key) {
        if (spokenKeysRef.current.has(opts.key)) return;
        spokenKeysRef.current.add(opts.key);
      }

      const u = new SpeechSynthesisUtterance(humanizeForSpeech(text));
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        opts?.onEnd?.();
      };
      window.speechSynthesis.speak(u);
    },
    [enabled],
  );

  // Cancel on unmount — don't let a lingering utterance carry across pages.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { enabled, speaking, toggle, setEnabled, speak, cancel };
}
