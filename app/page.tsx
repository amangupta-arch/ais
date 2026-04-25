import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <main className="lm-page">
      <div className="mx-auto" style={{ maxWidth: 768, padding: "56px 24px 96px" }}>
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
          <Link
            href="/login"
            style={{
              fontSize: 14,
              color: "var(--text-2)",
              textDecoration: "none",
              transition: "color 160ms cubic-bezier(0.2,0,0,1)",
            }}
          >
            sign in
          </Link>
        </header>

        <section style={{ marginTop: 96 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>01</span>
            the premise
          </p>
          <h1
            className="lm-serif"
            style={{
              marginTop: 12,
              fontSize: 56,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            Ten minutes a day.<br />
            Real <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>AI skill</em>.
          </h1>
          <p
            style={{
              marginTop: 24,
              maxWidth: 560,
              fontSize: 18,
              lineHeight: 1.55,
              color: "var(--text-2)",
            }}
          >
            A tutor who remembers you. Every lesson is a short conversation —
            not a video, not a textbook — built in short, real moves.
          </p>
          <div
            className="flex flex-col sm:flex-row sm:items-center"
            style={{ gap: 12, marginTop: 40 }}
          >
            <Link href="/onboarding" className="lm-btn lm-btn--accent lm-btn--lg">
              Start the quiz — 90 seconds <ArrowRight className="h-4 w-4" />
            </Link>
            <span style={{ fontSize: 14, color: "var(--text-3)" }}>
              No sign-up needed to start.
            </span>
          </div>
        </section>

        <section
          className="grid sm:grid-cols-2"
          style={{ marginTop: 112, gap: 40 }}
        >
          <div>
            <p className="lm-eyebrow">
              <span className="lm-tabular" style={{ marginRight: 8 }}>02</span>
              how it feels
            </p>
            <h2
              className="lm-serif"
              style={{
                marginTop: 12,
                fontSize: 32,
                lineHeight: 1.1,
                color: "var(--text)",
              }}
            >
              A <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>chat</em>,
              not a course.
            </h2>
            <p
              style={{
                marginTop: 12,
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--text-2)",
              }}
            >
              Every lesson is a conversation. A tutor asks, you answer, you try
              something small. Learning happens the way practice does — in short,
              real moves.
            </p>
          </div>

          <div>
            <p className="lm-eyebrow">
              <span className="lm-tabular" style={{ marginRight: 8 }}>03</span>
              what builds
            </p>
            <h2
              className="lm-serif"
              style={{
                marginTop: 12,
                fontSize: 32,
                lineHeight: 1.1,
                color: "var(--text)",
              }}
            >
              A <em style={{ fontStyle: "italic", color: "var(--saffron-deep)" }}>habit</em>,
              not a shelf.
            </h2>
            <p
              style={{
                marginTop: 12,
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--text-2)",
              }}
            >
              A streak that means something. A plan that knows you got here in 10 minutes,
              not 10 hours. A tutor who asks a better question tomorrow.
            </p>
          </div>
        </section>

        <section style={{ marginTop: 112 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>04</span>
            who it&apos;s for
          </p>
          <h2
            className="lm-serif"
            style={{
              marginTop: 12,
              fontSize: 32,
              lineHeight: 1.1,
              color: "var(--text)",
            }}
          >
            Anyone past the ChatGPT ceiling.
          </h2>
          <p
            style={{
              marginTop: 12,
              maxWidth: 560,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--text-2)",
            }}
          >
            You&apos;ve tried it. You&apos;ve sensed what&apos;s possible. You want the next floor —
            the part where it&apos;s a tool you actually use, not a tab you occasionally open.
          </p>
        </section>

        <section
          className="lm-card"
          style={{ marginTop: 112, padding: "40px 32px" }}
        >
          <h2
            className="lm-serif"
            style={{ fontSize: 40, lineHeight: 1.05, color: "var(--text)" }}
          >
            Begin <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>when you&apos;re ready</em>.
          </h2>
          <p
            style={{
              marginTop: 12,
              maxWidth: 480,
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--text-2)",
            }}
          >
            Seven questions. No email until the end. We&apos;ll show you your plan first —
            you decide from there.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link href="/onboarding" className="lm-btn lm-btn--accent lm-btn--lg">
              Take the quiz <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <footer
          className="flex items-center justify-between"
          style={{
            marginTop: 96,
            paddingTop: 32,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-3)",
          }}
        >
          <span>AIS · a daily AI tutor</span>
          <Link
            href="/login"
            style={{ color: "var(--text-3)", textDecoration: "none" }}
          >
            sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
