// /join/contact-us
//
// Where non-6-10 quiz takers land after we've saved their answers.
// We're not selling plans for those classes yet; we want a thank-
// you screen that captures intent and offers a clear next step.

import Link from "next/link";

import "@/app/landing.css";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CONTACT_EMAIL = "hello@myaisetu.com";

export default async function ContactUsPage() {
  // The user just submitted the quiz, so they're (probably) signed
  // in — read their profile so we can address them by name and
  // pre-populate the mailto.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("first_name, email, school_class").eq("id", user.id).maybeSingle()
    : { data: null };

  const firstName = profile?.first_name ?? "there";
  const cls = profile?.school_class ?? "your class";
  const email = profile?.email ?? user?.email ?? "";

  const mailtoSubject = encodeURIComponent(`Interested in AI Setu — class ${cls}`);
  const mailtoBody = encodeURIComponent(
    `Hi AI Setu team,\n\nI just took the quiz and I'm in ${cls}. Please email me when content for my class is live.\n\nMy email: ${email}\n\nThanks!\n${firstName}`,
  );
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="landing">
      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "80px 24px 96px",
          textAlign: "center",
        }}
      >
        <p
          className="lm-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-3)",
            fontWeight: 600,
            marginBottom: 14,
          }}
        >
          Thanks for the answers
        </p>
        <h1
          className="lm-serif"
          style={{
            fontSize: 36,
            lineHeight: 1.1,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            margin: 0,
            color: "var(--ink)",
          }}
        >
          Hey {firstName} — we&rsquo;re not live for{" "}
          <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>{cls}</em> yet.
        </h1>
        <p
          className="lm-serif"
          style={{
            fontStyle: "italic",
            marginTop: 18,
            fontSize: 16.5,
            lineHeight: 1.55,
            color: "var(--text-2)",
          }}
        >
          We&rsquo;re launching for Class 6–10 first. The curriculum for higher classes is being
          built. Send us a quick note and we&rsquo;ll write to you the day it ships — usually a
          week or two out.
        </p>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a href={mailtoHref} className="btn btn--primary">
            Email us at {CONTACT_EMAIL}
          </a>
          <Link href="/" className="btn btn--cream">
            Browse free content
          </Link>
        </div>

        <p
          style={{
            marginTop: 40,
            fontSize: 12,
            color: "var(--text-3)",
            lineHeight: 1.5,
          }}
        >
          We saved your answers so you don&rsquo;t have to re-do the quiz when your class goes
          live.
        </p>
      </main>
    </div>
  );
}
