"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { stripMarkdown } from "@/lib/audio/sanitize";

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

/** Pre-process lesson text for SpeechSynthesis. Two jobs:
 *  1. Strip markdown formatting + dashes via the shared stripMarkdown
 *     helper (same one the ElevenLabs pipeline uses).
 *  2. Spell out initialisms via PRONUNCIATIONS so brand names sound right.
 *  All other punctuation is left alone — TTS engines handle commas,
 *  periods, and question marks correctly out of the box. */
function humanizeForSpeech(text: string): string {
  let out = stripMarkdown(text);
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

type PlayClipsOptions = {
  /** Dedupe key — playClips(urls, key) is a no-op on subsequent calls with the same key. */
  key?: string;
  /** Fired when the LAST clip in the sequence finishes naturally (not on cancel). */
  onEnd?: () => void;
};

export type AudioNarration = {
  enabled: boolean;
  speaking: boolean;
  toggle: () => void;
  setEnabled: (on: boolean) => void;
  speak: (text: string, opts?: SpeakOptions) => void;
  /** Play a sequence of remote mp3s in order. Used by the lesson player
   *  when the ElevenLabs manifest has audio for the active turn. */
  playClips: (urls: string[], opts?: PlayClipsOptions) => void;
  cancel: () => void;
};

/** Thin wrapper around SpeechSynthesis + HTMLAudioElement with
 *  enable/disable persisted to localStorage. Safe to call on the
 *  server (it no-ops); the state hydrates once the client mounts.
 *  Two playback paths:
 *    speak(text) — browser TTS via SpeechSynthesisUtterance, used as
 *      fallback when no pre-generated mp3 exists for the active turn.
 *    playClips(urls) — sequentially plays remote mp3s through a
 *      single HTMLAudioElement, used when the lesson_audio_manifest
 *      has ElevenLabs audio for the active turn. */
export function useAudioNarration(): AudioNarration {
  const [enabled, setEnabledState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const spokenKeysRef = useRef<Set<string>>(new Set());
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Single shared <audio> element + token used to ignore stale events
  // after a cancel.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);
  const playedKeysRef = useRef<Set<string>>(new Set());

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
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    // Bump the play token so any in-flight onended callbacks from the
    // mp3 sequence are ignored, then pause the current element.
    playTokenRef.current++;
    const el = audioElRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        /* ignore */
      }
    }
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

  const playClips = useCallback(
    (urls: string[], opts?: PlayClipsOptions) => {
      if (!enabled) return;
      if (typeof window === "undefined") return;
      if (urls.length === 0) return;

      if (opts?.key) {
        if (playedKeysRef.current.has(opts.key)) return;
        playedKeysRef.current.add(opts.key);
      }

      // Cancel any in-flight playback so the new sequence wins.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      playTokenRef.current++;
      const myToken = playTokenRef.current;

      // Reuse one element across the lesson — avoids autoplay-policy
      // issues some browsers have with rapidly created <audio> nodes.
      let el = audioElRef.current;
      if (!el) {
        el = new Audio();
        el.preload = "auto";
        audioElRef.current = el;
      }

      let i = 0;
      const playNext = () => {
        if (myToken !== playTokenRef.current) return; // cancelled
        if (i >= urls.length) {
          setSpeaking(false);
          opts?.onEnd?.();
          return;
        }
        const url = urls[i++]!;
        // Re-bind handlers each tick so a previous clip's onended
        // doesn't fire after we've moved on.
        el!.onended = () => {
          if (myToken !== playTokenRef.current) return;
          playNext();
        };
        el!.onerror = () => {
          if (myToken !== playTokenRef.current) return;
          // On error, skip the broken clip and keep going.
          playNext();
        };
        el!.src = url;
        el!.currentTime = 0;
        const p = el!.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // Autoplay blocked / network error — bail to next clip.
            if (myToken !== playTokenRef.current) return;
            playNext();
          });
        }
      };

      setSpeaking(true);
      playNext();
    },
    [enabled],
  );

  // Cancel on unmount — don't let a lingering utterance / clip carry
  // across pages.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      const el = audioElRef.current;
      if (el) {
        try {
          el.pause();
          el.removeAttribute("src");
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return { enabled, speaking, toggle, setEnabled, speak, playClips, cancel };
}
