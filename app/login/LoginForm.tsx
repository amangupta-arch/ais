"use client";

// /login — returning-user sign-in. Three methods:
//   - Google OAuth
//   - Email + password (single field, signs in if registered, signs
//     up otherwise — same pattern as /join)
//   - Mobile + OTP (requires Supabase phone auth + SMS provider
//     configured in the dashboard)
//
// Magic-link sign-in was removed.

import { useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { safeNext } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/browser";

type Mode = "choose" | "email" | "phone" | "otp";

function LoginInner() {
  const params = useSearchParams();
  // Sanitize: window.location.href = next would happily navigate
  // off-site for `?next=https://evil.com`, and the value is also
  // forwarded through the OAuth round-trip into the Supabase
  // redirectTo, so an unsafe value would propagate past Google
  // and back into /auth/callback. Lock to local paths only.
  const next = safeNext(params.get("next"));

  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);

  const finishWithSession = () => {
    window.location.href = next;
  };

  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  };

  const continueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const signIn = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signIn.data.session) {
        finishWithSession();
        return;
      }
      const signUp = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (signUp.error) {
        const msg = signUp.error.message.toLowerCase();
        if (msg.includes("already")) {
          throw new Error("That email is registered — check the password and try again.");
        }
        throw signUp.error;
      }
      if (signUp.data.session) {
        finishWithSession();
        return;
      }
      // No session ⇒ Supabase has email confirmations on.
      setPendingEmailConfirm(true);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't sign you in. Try again.");
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(digits)) {
        throw new Error("Enter a 10-digit Indian mobile number.");
      }
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${digits}`,
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("phone") && msg.includes("not")) {
          throw new Error("Mobile sign-in isn't enabled yet — please use Google or email.");
        }
        throw error;
      }
      setMode("otp");
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't send the code. Try again.");
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, "");
      const token = otp.replace(/\D/g, "");
      if (token.length !== 6) {
        throw new Error("Enter the 6-digit code we sent you.");
      }
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${digits}`,
        token,
        type: "sms",
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error("Couldn't complete sign-in. Try requesting a new code.");
      }
      finishWithSession();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't verify the code. Try again.");
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
          {pendingEmailConfirm ? (
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
                Confirm <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>{email}</em>
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
                We sent a confirmation link. Tap it to finish signing in.
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
                Google, email, or mobile.
              </p>

              {mode === "choose" && (
                <div className="flex flex-col" style={{ gap: 12, marginTop: 28 }}>
                  <button
                    type="button"
                    className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
                    onClick={signInWithGoogle}
                    disabled={busy}
                  >
                    Continue with Google
                  </button>
                  <button
                    type="button"
                    className="lm-btn lm-btn--secondary lm-btn--lg lm-btn--full"
                    onClick={() => {
                      setError(null);
                      setMode("email");
                    }}
                    disabled={busy}
                  >
                    Continue with email
                  </button>
                  <button
                    type="button"
                    className="lm-btn lm-btn--secondary lm-btn--lg lm-btn--full"
                    onClick={() => {
                      setError(null);
                      setMode("phone");
                    }}
                    disabled={busy}
                  >
                    Continue with mobile
                  </button>
                </div>
              )}

              {mode === "email" && (
                <form
                  className="flex flex-col"
                  style={{ gap: 12, marginTop: 28 }}
                  onSubmit={continueWithEmail}
                >
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="lm-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    minLength={8}
                    placeholder="Password (min 8 characters)"
                    className="lm-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
                    disabled={busy || password.length < 8}
                  >
                    {busy ? "Signing you in…" : "Continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("choose")}
                    disabled={busy}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--indigo)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      font: "inherit",
                      marginTop: 4,
                    }}
                  >
                    ← other sign-in options
                  </button>
                </form>
              )}

              {mode === "phone" && (
                <form
                  className="flex flex-col"
                  style={{ gap: 12, marginTop: 28 }}
                  onSubmit={sendOtp}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "stretch",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-3)",
                      background: "var(--paper-pure)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "0 14px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 15,
                        color: "var(--text-2)",
                        background: "var(--bg-soft)",
                        borderRight: "1px solid var(--border)",
                      }}
                    >
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      required
                      placeholder="10-digit mobile"
                      className="lm-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      style={{
                        border: 0,
                        borderRadius: 0,
                        flex: 1,
                        boxShadow: "none",
                        background: "transparent",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
                    disabled={busy || !/^[6-9]\d{9}$/.test(phone)}
                  >
                    {busy ? "Sending code…" : "Send code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("choose")}
                    disabled={busy}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--indigo)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      font: "inherit",
                      marginTop: 4,
                    }}
                  >
                    ← other sign-in options
                  </button>
                </form>
              )}

              {mode === "otp" && (
                <form
                  className="flex flex-col"
                  style={{ gap: 12, marginTop: 28 }}
                  onSubmit={verifyOtp}
                >
                  <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
                    Enter the 6-digit code we sent to <strong>+91 {phone}</strong>.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    placeholder="6-digit code"
                    className="lm-input"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 22 }}
                  />
                  <button
                    type="submit"
                    className="lm-btn lm-btn--accent lm-btn--lg lm-btn--full"
                    disabled={busy || otp.length !== 6}
                  >
                    {busy ? "Verifying…" : "Verify and continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtp("");
                      setMode("phone");
                    }}
                    disabled={busy}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--indigo)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      font: "inherit",
                      marginTop: 4,
                    }}
                  >
                    ← change number
                  </button>
                </form>
              )}

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
                  href="/join"
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
