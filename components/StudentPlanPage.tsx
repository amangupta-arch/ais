// Shared layout for the three /student-plan-* routes.
//
// Server-rendered. Auth-agnostic — any visitor can browse plans
// before signing in. Subscribe CTAs route to /join (the quiz
// funnel) regardless of which plan card was clicked — the funnel
// handles class detection, sign-in, and Cashfree handoff.

import Link from "next/link";

import LandingClient from "@/app/landing-client";

import type { StudentCohort } from "@/lib/student-plans";

export default function StudentPlanPage({ cohort }: { cohort: StudentCohort }) {
  const hueDeep = `var(--${cohort.hue}-deep)`;
  const hueSoft = `var(--${cohort.hue}-soft)`;

  return (
    <div className="landing">
      <LandingClient />

      {/* ============ NAV — same chrome as the landing page ============ */}
      <nav className="nav">
        <div className="nav__inner">
          <Link className="brand" href="/">
            <BrandMark />
            <span className="brand__word">ai setu<em>.</em></span>
            <span className="brand__lang">सेतु</span>
          </Link>
          <div className="nav__links">
            <Link href="/student-plan-stt">Class 6–10</Link>
            <Link href="/student-plan-eat">Class 11–12</Link>
            <Link href="/student-plan-bach">College</Link>
            <Link href="/#features">How it works</Link>
            <a href="mailto:hello@myaisetu.com">Schools</a>
          </div>
          <div className="nav__cta">
            <Link className="btn btn--ghost" href="/login">Sign in</Link>
            <button className="nav__menu" id="navMenuBtn" aria-label="Open menu" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="nav__drawer" id="navDrawer">
          <Link href="/student-plan-stt">Class 6–10</Link>
          <Link href="/student-plan-eat">Class 11–12</Link>
          <Link href="/student-plan-bach">College</Link>
          <Link href="/#features">How it works</Link>
          <a href="mailto:hello@myaisetu.com">Schools</a>
          <Link href="/login">Sign in</Link>
        </div>
      </nav>

      {/* ============ HEADER ============ */}
      <header
        className="plan-detail__hero"
        style={
          {
            background: `linear-gradient(180deg, ${hueSoft} 0%, var(--paper) 100%)`,
          } as React.CSSProperties
        }
      >
        <div className="plan-detail__hero-inner">
          <div className="features__eyebrow" style={{ color: hueDeep, marginBottom: 14 }}>
            {cohort.classRange} · Pricing
          </div>
          <h1 className="plan-detail__title">
            {cohort.title}{" "}
            <em>{cohort.classRange.replace("Class ", "Class ").replace("Bachelors", "Bachelors")}</em>
          </h1>
          <p className="plan-detail__intro">{cohort.intro}</p>
        </div>
      </header>

      {/* ============ TIER CARDS ============ */}
      <section className="plan-detail__tiers">
        <div className="tiers">
          {cohort.plans.map((plan) => (
            <div
              key={plan.id}
              className={plan.recommended ? "tier tier--featured" : "tier"}
            >
              {plan.recommended && <div className="tier__badge">Most chosen</div>}
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
              {/* All Subscribe CTAs route to /join — the quiz funnel
                  is the single source of payment entry now, regardless
                  of which plan card a visitor came from. The funnel
                  collects their class and routes Class 6-10 into
                  Cashfree; other classes get the email-us flow. */}
              <Link className="tier__cta" href="/join">
                Subscribe · ₹{plan.priceInr}/mo
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ============ WHAT'S ALSO INCLUDED ============ */}
      <section className="plan-detail__included">
        <div className="plan-detail__included-inner">
          <div className="features__eyebrow" style={{ color: hueDeep, marginBottom: 14 }}>
            What every plan includes
          </div>
          <h2 className="plan-detail__h2">
            Same Maya. Same paper. <em>Same warmth.</em>
          </h2>
          <ul className="plan-detail__bullets">
            {cohort.whatsAlsoIncluded.map((b) => (
              <li key={b}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  style={{ color: hueDeep }}
                >
                  <path d="M5 12l5 5 9-12" />
                </svg>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============ OTHER COHORTS ============ */}
      <section className="plan-detail__others">
        <div className="features__eyebrow" style={{ marginBottom: 14 }}>
          Looking for a different age?
        </div>
        <div className="plan-detail__others-grid">
          {(["stt", "eat", "bach"] as const)
            .filter((k) => k !== cohort.shortKey)
            .map((k) => {
              const meta = OTHER_COHORT_META[k];
              return (
                <Link key={k} href={meta.route} className="plan-detail__other-card">
                  <div
                    className="plan-detail__other-eyebrow"
                    style={{ color: `var(--${meta.hue}-deep)` }}
                  >
                    {meta.range}
                  </div>
                  <div className="plan-detail__other-title">{meta.title}</div>
                  <div className="plan-detail__other-meta">
                    From ₹{meta.fromInr}/mo
                    <ArrowSvg />
                  </div>
                </Link>
              );
            })}
        </div>
      </section>

      {/* ============ FAQ / CONTACT ============ */}
      <section className="plan-detail__faq">
        <div className="plan-detail__faq-inner">
          <h2 className="plan-detail__h2">
            Got <em>questions</em>?
          </h2>
          <p className="plan-detail__faq-p">
            Cancel any time. No card needed for the first lesson of every course. Payments are
            handled by Cashfree, India&rsquo;s biggest PG; UPI Autopay, cards, and net-banking are
            all supported.
          </p>
          <p className="plan-detail__faq-p">
            For schools, coaching centres, and bulk plans, write to us at{" "}
            <a href="mailto:hello@myaisetu.com" style={{ color: "var(--indigo)" }}>
              hello@myaisetu.com
            </a>
            .
          </p>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="foot">
        <div className="foot__inner" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div className="foot__col foot__brand">
            <Link className="brand" href="/">
              <BrandMark small />
              <span className="brand__word">ai setu<em>.</em></span>
            </Link>
            <p>
              A bridge from where you are to where you want to go. Made in India, for the world.
            </p>
          </div>
          <FooterCol
            title="Plans"
            items={[
              { label: "Class 6–10", href: "/student-plan-stt" },
              { label: "Class 11–12", href: "/student-plan-eat" },
              { label: "College", href: "/student-plan-bach" },
              { label: "For schools", href: "mailto:hello@myaisetu.com" },
            ]}
          />
          <FooterCol
            title="Product"
            items={[
              { label: "How it works", href: "/#features" },
              { label: "Learning paths", href: "/#paths" },
              { label: "Pricing", href: "/#pricing" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { label: "Sign in", href: "/login" },
              { label: "Start free", href: "/onboarding" },
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
            ]}
          />
        </div>
        <div className="foot__bottom">
          <span>© 2026 AI Setu Technologies · myaisetu.com</span>
          <span>
            <Link href="/">← back to home</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─── tiny shared bits ─────────────────────────────────────────────────

const OTHER_COHORT_META: Record<
  "stt" | "eat" | "bach",
  { route: string; title: string; range: string; fromInr: number; hue: string }
> = {
  stt: { route: "/student-plan-stt", title: "School Student", range: "Class 6 – 10", fromInr: 59, hue: "indigo" },
  eat: { route: "/student-plan-eat", title: "School Student", range: "Class 11 – 12", fromInr: 199, hue: "saffron" },
  bach: { route: "/student-plan-bach", title: "College Student", range: "Bachelors", fromInr: 199, hue: "moss" },
};

function BrandMark({ small }: { small?: boolean }) {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="18" stroke="var(--ink)" strokeWidth={1.5} />
      <circle cx="20" cy="20" r="11" stroke="var(--ink)" strokeWidth={1.5} opacity={0.5} />
      <circle cx="20" cy="20" r="5" fill="var(--indigo)" />
      {!small && <circle cx="20" cy="20" r="1.5" fill="var(--paper)" />}
    </svg>
  );
}

function ArrowSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div className="foot__col">
      <h4>{title}</h4>
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href}>{it.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
