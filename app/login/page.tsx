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
    <main className="mx-auto max-w-md px-6 pt-16 pb-24 min-h-[100dvh] flex flex-col">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-serif text-lg text-ink-900">AIS</Link>
      </header>

      <div className="flex-1 flex flex-col justify-center py-10">
        {state === "sent" ? (
          <div>
            <Eyebrow>inbox</Eyebrow>
            <Display as="h1" size="lg" className="mt-3">
              Magic link sent to <em className="italic font-normal">{email}</em>.
            </Display>
            <p className="mt-5 text-ink-600 leading-relaxed">
              Tap the link to continue. It'll bring you back here, signed in.
            </p>
            <p className="mt-8 text-sm text-ink-500">
              Didn't arrive?{" "}
              <button className="underline hover:text-ink-800" onClick={sendMagicLink}>
                send again
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            <Eyebrow>welcome back</Eyebrow>
            <Display as="h1" size="lg" className="mt-3">Sign in.</Display>
            <p className="mt-4 text-ink-600">No password. Just a link or Google.</p>

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
                className="rounded-full px-5 h-12 bg-paper-100 border border-paper-200 outline-none focus:border-ember-500 transition-colors"
              />
              <Button type="submit" size="lg" disabled={state === "sending" || email.trim().length < 4}>
                {state === "sending" ? "Sending…" : "Send magic link"}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-ink-500">
              <div className="flex-1 h-px bg-paper-300" />
              or
              <div className="flex-1 h-px bg-paper-300" />
            </div>

            <Button variant="outline" size="lg" onClick={signInWithGoogle} disabled={state === "sending"}>
              Continue with Google
            </Button>

            {error ? <p className="mt-4 text-sm text-ember-700">{error}</p> : null}

            <p className="mt-8 text-sm text-ink-500">
              New here?{" "}
              <Link href="/onboarding" className="underline hover:text-ink-800">take the quiz first</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
