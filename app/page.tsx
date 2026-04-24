import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="mx-auto max-w-3xl px-6 pt-14 pb-24 sm:pt-20">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-tight text-ink-900">AIS</Link>
        <Link
          href="/login"
          className="text-sm text-ink-600 hover:text-ink-900 transition-colors duration-150 ease-out"
        >
          sign in
        </Link>
      </header>

      <section className="mt-16 sm:mt-24">
        <Eyebrow number="01">The premise</Eyebrow>
        <Display as="h1" size="xl" className="mt-3">
          Ten minutes a day.<br />Real AI skill.
        </Display>
        <p className="mt-6 max-w-xl text-lg text-ink-700 leading-relaxed">
          A tutor who remembers you. Every lesson is a short conversation — not a video, not a textbook — built in short, real moves.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center">
          <ButtonLink href="/onboarding" size="lg">
            Start the quiz — 90 seconds <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <span className="text-sm text-ink-500 sm:ml-2">
            No sign-up needed to start.
          </span>
        </div>
      </section>

      <section className="mt-24 sm:mt-28 grid gap-10 sm:grid-cols-2">
        <div>
          <Eyebrow number="02">How it feels</Eyebrow>
          <Display as="h2" size="md" className="mt-3">A chat, not a course.</Display>
          <p className="mt-3 text-ink-700 leading-relaxed">
            Every lesson is a conversation. A tutor asks, you answer, you try something small. Learning happens the way practice does — in short, real moves.
          </p>
        </div>

        <div>
          <Eyebrow number="03">What builds</Eyebrow>
          <Display as="h2" size="md" className="mt-3">A habit, not a shelf.</Display>
          <p className="mt-3 text-ink-700 leading-relaxed">
            A streak that means something. A plan that knows you got here in 10 minutes, not 10 hours. A tutor who asks a better question tomorrow.
          </p>
        </div>
      </section>

      <section className="mt-24 sm:mt-28">
        <Eyebrow number="04">Who it's for</Eyebrow>
        <Display as="h2" size="md" className="mt-3">Anyone past the ChatGPT ceiling.</Display>
        <p className="mt-3 max-w-xl text-ink-700 leading-relaxed">
          You've tried it. You've sensed what's possible. You want the next floor — the part where it's a tool you actually use, not a tab you occasionally open.
        </p>
      </section>

      <section className="mt-24 sm:mt-28 rounded-lg bg-white border border-ink-200 p-8 sm:p-10">
        <Display as="h2" size="lg">Begin when you're ready.</Display>
        <p className="mt-3 max-w-md text-ink-700 leading-relaxed">
          Seven questions. No email until the end. We'll show you your plan first — you decide from there.
        </p>
        <div className="mt-6">
          <ButtonLink href="/onboarding" size="lg">
            Take the quiz <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>

      <footer className="mt-24 pt-8 border-t border-ink-200 flex items-center justify-between text-xs text-ink-500">
        <span>AIS · a daily AI tutor</span>
        <Link href="/login" className="hover:text-ink-700 transition-colors">sign in</Link>
      </footer>
    </main>
  );
}
