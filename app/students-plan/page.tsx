// /students-plan
//
// The explicit offer checkpoint between Google sign-up and Cashfree.
// Used to be: sign-up → /join/finalize → /api/checkout/start →
// Cashfree (all in one silent chain, with the visitor bounced back
// to /join?error=… on any failure).
//
// Now: sign-up → /join/finalize → /students-plan (this page) →
// (visitor clicks Pay) → /api/checkout/start → Cashfree. Cashfree
// failures redirect back here with ?error=…, so the visitor sees a
// banner + retry on the same offer they just looked at.
//
// Auth-gated — visitors without a session get punted back to /join.
// Class 6–10 is the only cohort with Cashfree wired up today; other
// classes shouldn't reach this page (applyPendingQuiz routes them
// to /join/contact-us), but if they somehow do, we degrade to a
// "contact us" message instead of pricing a plan they can't buy yet.
//
// Note: we use the same .landing chrome as /checkout because the
// .tier--featured / .tier__cta styles in app/landing.css are scoped
// under .landing.

import Link from "next/link";
import { redirect } from "next/navigation";

import LandingClient from "../landing-client";
import "../landing.css";

import { createClient } from "@/lib/supabase/server";
import { STUDENT_COHORTS } from "@/lib/student-plans";

export const dynamic = "force-dynamic";

const SCHOOL_6_TO_10 = new Set(["6", "7", "8", "9", "10"]);
const CONTACT_EMAIL = "hello@myaisetu.com";

export default async function StudentsPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/join");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, school_class")
    .eq("id", user.id)
    .maybeSingle();

  const firstName = profile?.first_name?.trim() || "there";
  const cls = profile?.school_class ?? null;

  // Only Class 6-10 has a real Cashfree plan wired up. Anyone else
  // who lands here (e.g. by typing the URL directly) gets nudged to
  // the contact-us page instead of being shown a plan they can't buy.
  const eligible = cls && SCHOOL_6_TO_10.has(cls);

  if (!eligible) {
    return (
      <div className="landing">
        <LandingClient />
        <Nav />
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px 96px", textAlign: "center" }}>
          <h1 className="plan-detail__title" style={{ marginBottom: 16 }}>
            Plans for <em>{cls ?? "your class"}</em> aren&rsquo;t live yet.
          </h1>
          <p className="plan-detail__intro" style={{ marginBottom: 28 }}>
            We&rsquo;re launching for Class 6–10 first. Drop us a note and we&rsquo;ll
            email you the moment your class goes live.
          </p>
          <Link className="btn btn--primary" href="/join/contact-us">
            Tell me when it&rsquo;s live
          </Link>
        </main>
      </div>
    );
  }

  // STUDENT_COHORTS.stt.plans[1] is school-6-10-all (₹199, recommended).
  const plan = STUDENT_COHORTS.stt.plans[1]!;

  return (
    <div className="landing">
      <LandingClient />
      <Nav />

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "64px 24px 96px" }}>
        <div className="features__eyebrow" style={{ marginBottom: 14, color: "var(--indigo-deep)" }}>
          Hi {firstName} · Your plan
        </div>
        <h1 className="plan-detail__title" style={{ marginBottom: 12 }}>
          Your Maya is ready. <em>One last step.</em>
        </h1>
        <p className="plan-detail__intro" style={{ marginBottom: 28 }}>
          Class 6–10, all subjects, all 12 languages. Cancel any time. Payments handled
          by Cashfree (UPI Autopay, cards, net-banking).
        </p>

        {error && (
          <div
            role="alert"
            style={{
              margin: "0 0 24px",
              padding: "12px 16px",
              background: "var(--coral-soft)",
              border: "1px solid var(--coral)",
              borderRadius: "var(--r-3)",
              color: "var(--coral-deep)",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div className="tier tier--featured" style={{ maxWidth: 380, width: "100%" }}>
            <div className="tier__badge">Most chosen</div>
            <div className="tier__name">{plan.label}</div>
            <div className="tier__price">
              <span className="cur">₹</span>
              {plan.priceInr}
              <span className="per"> / month</span>
            </div>
            <div className="tier__sub">{plan.tagline}</div>
            <ul className="tier__list">
              {plan.features.map((f) => (
                <li key={f}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M5 12l5 5 9-12" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <a className="tier__cta" href={`/api/checkout/start?plan=${plan.id}`}>
              Pay ₹{plan.priceInr} / month
            </a>
          </div>
        </div>

        <p
          style={{
            marginTop: 32,
            fontSize: 12.5,
            color: "var(--text-3)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Trouble paying? Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--indigo)" }}>
            {CONTACT_EMAIL}
          </a>{" "}
          and we&rsquo;ll sort it out.
        </p>
      </main>
    </div>
  );
}

function Nav() {
  return (
    <nav className="nav">
      <div className="nav__inner">
        <Link className="brand" href="/">
          <svg className="brand__mark" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--ink)" strokeWidth={1.5} />
            <circle cx="20" cy="20" r="11" stroke="var(--ink)" strokeWidth={1.5} opacity={0.5} />
            <circle cx="20" cy="20" r="5" fill="var(--indigo)" />
            <circle cx="20" cy="20" r="1.5" fill="var(--paper)" />
          </svg>
          <span className="brand__word">ai setu<em>.</em></span>
        </Link>
        <div className="nav__links" />
        <div className="nav__cta">
          <Link className="btn btn--ghost" href="/home">My dashboard</Link>
        </div>
      </div>
    </nav>
  );
}
