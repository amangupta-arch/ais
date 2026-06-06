// /students-plan
//
// The explicit offer checkpoint between Google sign-up and Cashfree.
// Server-rendered chrome (auth gate, profile lookup, eligibility
// check). The card itself — including the phone input and Pay
// button — is a client island (CheckoutCard.tsx) because Cashfree's
// JS SDK runs in the browser.
//
// Flow:
//   /join/finalize → /students-plan → (visitor enters phone, clicks
//   Pay) → Cashfree.js SDK navigates to the hosted payment page →
//   /payment-success (after Cashfree redirects back).
//
// Auth-gated: visitors without a session get punted to /join.
// Class 6-10 is the only cohort with Cashfree wired up today; other
// classes shouldn't reach this page (applyPendingQuiz routes them
// to /join/contact-us) but if they somehow do, we show a polite
// "not live yet" message instead of pricing a plan they can't buy.

import Link from "next/link";
import { redirect } from "next/navigation";

import LandingClient from "../landing-client";
import "../landing.css";

import { createClient } from "@/lib/supabase/server";
import { STUDENT_COHORTS } from "@/lib/student-plans";

import CheckoutCard from "./CheckoutCard";

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
          Your plan is ready. <em>One last step.</em>
        </h1>
        <p className="plan-detail__intro" style={{ marginBottom: 28 }}>
          Class 6–10, all subjects, all 12 languages. Cancel any time. Payments handled
          by Cashfree (UPI Autopay, cards, net-banking).
        </p>

        <CheckoutCard plan={plan} initialError={error ?? null} />

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
