"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
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
    <main className="mx-auto max-w-md px-6 pt-14 pb-24 min-h-[100dvh] flex flex-col">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-tight text-ink-900">AIS</Link>
      </header>

      <div className="flex-1 flex flex-col justify-center py-10">
        {state === "sent" ? (
          <div>
            <Eyebrow>check your inbox</Eyebrow>
            <Display as="h1" size="lg" className="mt-2">
              Magic link sent to <span className="text-accent-700 break-all">{email}</span>.
            </Display>
            <p className="mt-4 text-ink-700 leading-relaxed">
              Tap the link to continue. It'll bring you back here, signed in.
            </p>
            <p className="mt-8 text-sm text-ink-500">
              Didn't arrive?{" "}
              <button className="underline hover:text-ink-800 transition-colors" onClick={sendMagicLink}>
                send again
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <Eyebrow>sign in</Eyebrow>
            <Display as="h1" size="lg" className="mt-2">Welcome back.</Display>
            <p className="mt-3 text-ink-700">No password. A link or Google.</p>

            <form
              className="mt-8 flex flex-col gap-3"
              onSubmit={(e) => { e.preventDefault(); sendMagicLink(); }}
            >
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md px-4 h-11 bg-white border border-ink-300 outline-none focus:border-accent-600 transition-colors duration-150 ease-out text-[15px]"
              />
              <Button type="submit" size="lg" disabled={state === "sending" || email.trim().length < 4}>
                {state === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-ink-500">
              <div className="flex-1 h-px bg-ink-200" />
              or
              <div className="flex-1 h-px bg-ink-200" />
            </div>

            <Button variant="secondary" size="lg" onClick={signInWithGoogle} disabled={state === "sending"}>
              Continue with Google
            </Button>

            {error ? <p className="mt-4 text-sm text-danger-600">{error}</p> : null}

            <p className="mt-8 text-sm text-ink-500">
              New here?{" "}
              <Link href="/onboarding" className="underline hover:text-ink-800 transition-colors">take the quiz first</Link>.
            </p>
          </>
        )}
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
