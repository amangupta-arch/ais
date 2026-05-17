"use client";

// Reads the pending-quiz blob the funnel stashed in localStorage,
// POSTs it to applyPendingQuiz, then redirects to the next page
// (checkout for class 6–10, contact-us otherwise).
//
// While the round-trip runs, show a tiny "connecting…" shimmer.
// If anything fails we surface a polite retry message instead of
// stranding the user on a blank screen.

import { useEffect, useState } from "react";

import { applyPendingQuiz, type PendingQuiz } from "../actions";

const LS_KEY = "ais.pending-quiz";

type State =
  | { kind: "working" }
  | { kind: "redirecting"; to: string }
  | { kind: "error"; message: string };

export default function FinalizeClient() {
  const [state, setState] = useState<State>({ kind: "working" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let quiz: PendingQuiz = {};
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (raw) quiz = JSON.parse(raw) as PendingQuiz;
      } catch {
        /* ignore */
      }

      const result = await applyPendingQuiz(quiz);
      if (cancelled) return;

      if (!result.ok) {
        setState({
          kind: "error",
          message:
            result.error === "not-signed-in"
              ? "Sign-in didn't complete. Please refresh and try once more."
              : "We saved your sign-in but couldn't load your plan. Try again in a moment.",
        });
        return;
      }

      // Clean up the local stash now that we've handed it off.
      try {
        window.localStorage.removeItem(LS_KEY);
      } catch {
        /* ignore */
      }

      setState({ kind: "redirecting", to: result.redirectTo });
      window.location.href = result.redirectTo;
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--indigo)",
          animation: "ais-spinner 0.9s linear infinite",
        }}
      />
      <p
        className="lm-serif"
        style={{
          marginTop: 24,
          fontStyle: "italic",
          fontSize: 17,
          color: "var(--text-2)",
          textAlign: "center",
          maxWidth: 360,
        }}
      >
        {state.kind === "error"
          ? state.message
          : state.kind === "redirecting"
          ? "Almost there…"
          : "Connecting your account to your plan…"}
      </p>
      {state.kind === "error" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="join-btn"
          style={{ marginTop: 24, width: "auto" }}
        >
          Try again
        </button>
      )}
      <style>{`
        @keyframes ais-spinner {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
