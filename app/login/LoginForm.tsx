"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/browser";

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/home";

  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const sendMagicLink = async () => {
    setState("sending");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setState("sent");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  };

  const signInWithGoogle = async () => {
    setState("sending");
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Google sign-in failed. Try email instead.");
    }
  };

  return (
    <main className="lm-page flex flex-col">
      <div
        className="mx-auto flex flex-col"
        style={{ maxWidth: 440, padding: "56px 24px 96px", flex: 1, width: "100%" }}
      >
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="lm-serif"
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            AIS
          </Link>
        </header>

        <div className="flex-1 flex flex-col justify-center" style={{ padding: "40px 0" }}>
          {state === "sent" ? (
            <div>
              <p className="lm-eyebrow">check your inbox</p>
              <h1
                className="lm-serif"
                style={{
                  marginTop: 8,
                  fontSize: 36,
                  lineHeight: 1.1,
                  color: "var(--text)",
                }}
              >
                Magic link sent to{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    color: "var(--indigo)",
                    wordBreak: "break-all",
                  }}
                >
                  {email}
                </em>
                .
              </h1>
              <p
                style={{
                  marginTop: 16,
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: "var(--text-2)",
                }}
              >
                Tap the link to continue. It&apos;ll bring you back here, signed in.
              </p>
              <p style={{ marginTop: 32, fontSize: 13, color: "var(--text-3)" }}>
                Didn&apos;t arrive?{" "}
                <button
                  type="button"
                  onClick={sendMagicLink}
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    color: "var(--indigo)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    font: "inherit",
                  }}
                >
                  send again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <p className="lm-eyebrow">sign in</p>
              <h1
                className="lm-serif"
                style={{
                  marginTop: 8,
                  fontSize: 40,
                  lineHeight: 1.05,
                  color: "var(--text)",
                }}
              >
                Welcome <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>back</em>.
              </h1>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--text-2)",
                }}
              >
                No password. A link or Google.
              </p>

              <form
                className="flex flex-col"
                style={{ gap: 12, marginTop: 32 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMagicLink();
                }}
              >
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="lm-input"
                />
                <button
                  type="submit"
                  className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
                  disabled={state === "sending" || email.trim().length < 4}
                >
                  {state === "sending" ? "Sending…" : "Send magic link"}
                </button>
              </form>

              <div
                className="flex items-center"
                style={{
                  gap: 12,
                  margin: "24px 0",
                  fontSize: 12,
                  color: "var(--text-3)",
                }}
              >
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                or
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <button
                type="button"
                className="lm-btn lm-btn--secondary lm-btn--lg lm-btn--full"
                onClick={signInWithGoogle}
                disabled={state === "sending"}
              >
                Continue with Google
              </button>

              {error ? (
                <p
                  style={{
                    marginTop: 16,
                    fontSize: 13,
                    color: "var(--coral-deep)",
                  }}
                >
                  {error}
                </p>
              ) : null}

              <p style={{ marginTop: 32, fontSize: 13, color: "var(--text-3)" }}>
                New here?{" "}
                <Link
                  href="/onboarding"
                  style={{
                    color: "var(--indigo)",
                    textDecoration: "underline",
                  }}
                >
                  take the quiz first
                </Link>
                .
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
