import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-16 pb-24 sm:pt-24">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-serif text-xl text-ink-900">AIS</Link>
        <Link
          href="/login"
          className="text-sm text-ink-600 hover:text-ink-900 transition-colors"
        >
          sign in
        </Link>
      </header>

      <section className="mt-16 sm:mt-24">
        <Eyebrow number="01">The obvious one</Eyebrow>
        <Display as="h1" size="xl" className="mt-4">
          Learning is a <em className="italic font-normal">practice</em>,<br />
          not an event.
        </Display>
        <p className="mt-6 max-w-xl text-lg text-ink-600 leading-relaxed">
          Ten minutes a day with a tutor who remembers you. Real AI skill, built in short,
          deliberate conversations — not videos, not textbooks.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center">
          <ButtonLink href="/onboarding" size="lg">Start the quiz — 90 seconds</ButtonLink>
          <span className="text-sm text-ink-500 sm:ml-2">
            No sign-up needed to start.
          </span>
        </div>
      </section>

      <section className="mt-24 sm:mt-28 grid gap-10 sm:grid-cols-2">
        <div>
          <Eyebrow number="02">How it feels</Eyebrow>
          <Display as="h2" size="md" className="mt-3">
            A chat, <em className="italic font-normal">not</em> a course.
          </Display>
          <p className="mt-4 text-ink-600 leading-relaxed">
            Every lesson is a conversation — a tutor asks, you answer, you try something small.
            Learning happens the way practice does: in short, real moves.
          </p>
        </div>

        <div>
          <Eyebrow number="03">What builds</Eyebrow>
          <Display as="h2" size="md" className="mt-3">
            A <em className="italic font-normal">habit</em>, not a shelf of certificates.
          </Display>
          <p className="mt-4 text-ink-600 leading-relaxed">
            A streak that actually means something. A plan that knows you got here in 10 minutes,
            not 10 hours. A tutor who asks a better question tomorrow.
          </p>
        </div>
      </section>

      <section className="mt-24 sm:mt-28">
        <Eyebrow number="04">Who it's for</Eyebrow>
        <Display as="h2" size="md" className="mt-3">
          Anyone who has hit the <em className="italic font-normal">ChatGPT ceiling</em>.
        </Display>
        <p className="mt-4 max-w-xl text-ink-600 leading-relaxed">
          You've tried it. You've sensed what's possible. You want the next floor —
          the part where it's a tool you actually use, not a tab you occasionally open.
        </p>
      </section>

      <section className="mt-24 sm:mt-28 rounded-3xl bg-paper-100 border border-paper-200 p-8 sm:p-12 shadow-paper">
        <Display as="h2" size="lg">
          Begin when you're <em className="italic font-normal">ready</em>.
        </Display>
        <p className="mt-4 max-w-md text-ink-600 leading-relaxed">
          Seven questions. No email yet. We'll show you your plan first — you decide from there.
        </p>
        <div className="mt-8">
          <ButtonLink href="/onboarding" size="lg">Take the quiz</ButtonLink>
        </div>
      </section>

      <footer className="mt-24 pt-8 border-t border-paper-200 flex items-center justify-between text-xs text-ink-500">
        <span>AIS · a daily AI tutor</span>
        <Link href="/login" className="hover:text-ink-700 transition-colors">sign in</Link>
      </footer>
    </main>
  );
}
