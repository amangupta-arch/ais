// /checkout — placeholder until the Cashfree integration lands.
//
// Reached by submitting any "Subscribe" form on /student-plan-*.
// Reads the plan slug from the query string, looks up the price +
// cohort, and tells the visitor we'll email them when payments
// open. When Cashfree is wired up this page becomes the post-
// payment success / pending screen.

import Link from "next/link";

import LandingClient from "../landing-client";
import "../landing.css";

import {
  findStudentPlan,
  findStudentPlanCohort,
} from "@/lib/student-plans";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; error?: string }>;
}) {
  const { plan: planId, error } = await searchParams;
  const plan = planId ? findStudentPlan(planId) : null;
  const cohort = planId ? findStudentPlanCohort(planId) : null;

  return (
    <div className="landing">
      <LandingClient />

      <nav className="nav">
        <div className="nav__inner">
          <Link className="brand" href="/">
            <BrandMark />
            <span className="brand__word">ai setu<em>.</em></span>
          </Link>
          <div className="nav__links" />
          <div className="nav__cta">
            <Link className="btn btn--ghost" href="/login">Sign in</Link>
            <Link className="btn btn--primary" href="/">
              Back to home
            </Link>
          </div>
        </div>
      </nav>

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "80px 24px 96px",
        }}
      >
        <div className="features__eyebrow" style={{ marginBottom: 14 }}>
          {error ? "Something didn't add up" : "Almost there"}
        </div>
        <h1 className="plan-detail__title" style={{ marginBottom: 16 }}>
          {error ? (
            <>We couldn&rsquo;t recognise that plan.</>
          ) : plan ? (
            <>
              You picked <em>{plan.label}</em> for ₹{plan.priceInr}/mo.
            </>
          ) : (
            <>Pick a plan to continue.</>
          )}
        </h1>

        {plan && cohort && (
          <p className="plan-detail__intro" style={{ marginBottom: 28 }}>
            That&rsquo;s the {plan.label.toLowerCase()} plan for{" "}
            <strong>{cohort.title} · {cohort.classRange}</strong>.
          </p>
        )}

        <div
          className="lm-card"
          style={{
            padding: 28,
            background: "var(--paper-pure)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-4)",
          }}
        >
          <div className="features__eyebrow" style={{ marginBottom: 8 }}>
            Cashfree integration coming soon
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--text-2)" }}>
            We&rsquo;re wiring up Cashfree Subscriptions right now (UPI Autopay, cards, net-banking).
            Drop us a note at{" "}
            <a href="mailto:hello@myaisetu.com" style={{ color: "var(--indigo)" }}>
              hello@myaisetu.com
            </a>{" "}
            and we&rsquo;ll email you the moment it&rsquo;s live — usually a 24-hour window.
          </p>
          <p
            style={{
              marginTop: 18,
              fontSize: 13,
              color: "var(--text-3)",
              fontFamily: "var(--font-jetbrains-mono), monospace",
            }}
          >
            plan_id · <strong style={{ color: "var(--text)" }}>{planId ?? "—"}</strong>
          </p>
        </div>

        <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="btn btn--primary" href="/onboarding">
            Try a free lesson while you wait
          </Link>
          {cohort && (
            <Link className="btn btn--cream" href={cohort.route}>
              Back to {cohort.classRange}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="var(--ink)" strokeWidth={1.5} />
      <circle cx="20" cy="20" r="11" stroke="var(--ink)" strokeWidth={1.5} opacity={0.5} />
      <circle cx="20" cy="20" r="5" fill="var(--indigo)" />
      <circle cx="20" cy="20" r="1.5" fill="var(--paper)" />
    </svg>
  );
}
