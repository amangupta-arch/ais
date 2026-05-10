"use client";

/** Top-level error boundary. Next.js renders this when an error
 *  bubbles past every nested error.tsx (or escapes a server component's
 *  render). We forward the error to Sentry so React render crashes get
 *  the same surface area as API failures, then show a minimal fallback
 *  with a retry path — `reset()` re-runs the failed segment so transient
 *  render/data errors recover without a full reload. */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          color: "#E2E8F0",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "#94A3B8",
              margin: "0 0 20px",
            }}
          >
            We&apos;ve logged the error. Try again — most issues clear on a
            second attempt.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: 0,
              background: "#4F46BA",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#475569",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ref: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
