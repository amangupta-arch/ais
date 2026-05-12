// Public landing page (https://myaisetu.com/).
//
// Server component — auth-aware: signed-in users skip the marketing
// surface and land on /home. Markup is lifted from the design team's
// "AI Setu Home.html" mockup, with CTAs pointed at real routes:
//
//   "Start free" / "Try a 5-minute lesson" / tier CTAs → /onboarding
//   "Sign in"                                          → /login
//   Schools / institutions CTAs                        → mailto for now
//
// Interactive bits (sticky-nav scroll state, mobile drawer, reveal-
// on-scroll) live in <LandingClient />, which mounts side effects
// after hydration. CSS is in app/landing.css, scoped under .landing.

import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import LandingClient from "./landing-client";
import "./landing.css";

export const dynamic = "force-dynamic";

const SCHOOLS_MAILTO = "mailto:hello@myaisetu.com?subject=Setu%20for%20schools%20%26%20coaching";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");

  return (
    <div className="landing">
      <LandingClient />

      {/* ============ NAV ============ */}
      <nav className="nav">
        <div className="nav__inner">
          <Link className="brand" href="/">
            <BrandMark />
            <span className="brand__word">ai setu<em>.</em></span>
            <span className="brand__lang">सेतु</span>
          </Link>
          <div className="nav__links">
            <a href="#audience">Who it&rsquo;s for</a>
            <a href="#features">How it works</a>
            <a href="#paths">Learning paths</a>
            <a href="#pricing">Pricing</a>
            <a href={SCHOOLS_MAILTO}>Schools</a>
          </div>
          <div className="nav__cta">
            <Link className="btn btn--ghost" href="/login">
              Sign in
            </Link>
            <button className="nav__menu" id="navMenuBtn" aria-label="Open menu" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        <div className="nav__drawer" id="navDrawer">
          <a href="#audience">Who it&rsquo;s for</a>
          <a href="#features">How it works</a>
          <a href="#paths">Learning paths</a>
          <a href="#pricing">Pricing</a>
          <a href={SCHOOLS_MAILTO}>Schools</a>
          <Link href="/login">Sign in</Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <header className="hero">
        <div className="hero__bridge" aria-hidden="true">
          <HeroBridgeSvg />
        </div>
        <span className="hero__eyebrow">
          <span className="dot"></span>
          Now in beta · myaisetu.com
        </span>
        <h1 className="hero__title">
          A bridge<br />
          to whatever<br />
          you want<br />
          to <em>learn next.</em>
        </h1>
        <p className="hero__sub">
          AI Setu (
          <span style={{ fontFamily: "'Noto Sans Devanagari', serif" }}>सेतु</span>
          , &ldquo;bridge&rdquo;) connects every learner — a ten-year-old, a UPSC aspirant, a working
          parent — to the right next step. Voice-first, paper-friendly, in your language.
        </p>
        <div className="hero__cta">
          <Link className="btn btn--primary" href="/onboarding">
            Try a 5-minute lesson
            <ArrowSvg />
          </Link>
          <a className="btn btn--cream" href={SCHOOLS_MAILTO}>
            For schools &amp; coaching
          </a>
          <span className="meta">
            <strong>Free forever</strong> for the first lesson of every course · No card needed
          </span>
        </div>
      </header>

      {/* ============ AUDIENCE BAND ============ */}
      <section className="audience" id="audience">
        <div className="audience__head">
          <h2 className="audience__lead">
            Built for the <em>whole house.</em>
            <br />
            Not just the kid with homework.
          </h2>
          <span className="audience__note">Five doorways · one app</span>
        </div>
        <div className="audience__grid">
          {AUDIENCE.map((a) => (
            <div
              key={a.num}
              className="aud"
              style={
                {
                  "--hue": `var(--${a.hue})`,
                  "--hue-deep": `var(--${a.hue}-deep)`,
                } as React.CSSProperties
              }
            >
              <div className="aud__num">{a.num} · {a.tag}</div>
              <div className="aud__title">{a.title}</div>
              <div className="aud__sub">{a.sub}</div>
              <div className="aud__chain">
                {a.chain.map((seg, i) => (
                  <span key={i} className={seg === "›" ? "sep" : undefined}>
                    {seg}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURE TRIO ============ */}
      <section className="features" id="features">
        <div className="features__head">
          <div className="features__eyebrow">What makes Setu different</div>
          <h2 className="features__title">
            Three small <em>refusals</em>
            <br />
            that change the feel of learning.
          </h2>
        </div>
        <div className="features__grid">
          <article
            className="feat"
            style={
              {
                "--feat-bg": "linear-gradient(140deg, var(--ocean-deep), var(--ocean))",
                "--feat-accent": "var(--ocean-deep)",
              } as React.CSSProperties
            }
          >
            <div className="feat__visual">
              <div className="feat__num">01</div>
              <div className="v-maya">
                <div className="wave"><i /><i /><i /><i /><i /></div>
              </div>
            </div>
            <h3 className="feat__h">
              We refused <em>silent</em> learning.
            </h3>
            <p className="feat__p">
              Maya is a voice tutor, not a chatbot. She asks, listens, and walks you through ideas
              like a patient elder cousin — in the same tongue you think in.
            </p>
            <div className="feat__tags">
              <span className="feat__tag">Voice-first</span>
              <span className="feat__tag">Always with you</span>
              <span className="feat__tag">Two-way</span>
            </div>
          </article>

          <article
            className="feat"
            style={
              {
                "--feat-bg": "#F1E7D3",
                "--feat-accent": "var(--saffron-deep)",
              } as React.CSSProperties
            }
          >
            <div className="feat__visual">
              <div className="feat__num" style={{ color: "var(--saffron-deep)" }}>02</div>
              <div className="v-paper">
                <div className="lines"></div>
                <div className="ink">
                  2x + 5 = 17<br />
                  2x = <b>12</b><br />
                  x = <b>6</b>
                </div>
                <div className="scan"></div>
                <div className="check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                    <path d="M5 12l5 5 9-12" />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className="feat__h">
              We refused the <em>screen-only</em> classroom.
            </h3>
            <p className="feat__p">
              Solve on paper like you always have. Snap a photo. Setu reads your handwriting, marks
              the work, and points at the exact line that went wrong.
            </p>
            <div className="feat__tags">
              <span className="feat__tag">Paper + camera</span>
              <span className="feat__tag">Step-by-step feedback</span>
              <span className="feat__tag">Any script</span>
            </div>
          </article>

          <article
            className="feat"
            style={
              {
                "--feat-bg": "linear-gradient(140deg, var(--plum-deep), var(--plum))",
                "--feat-accent": "var(--plum-deep)",
              } as React.CSSProperties
            }
          >
            <div className="feat__visual">
              <div className="feat__num">03</div>
              <div className="v-lang">
                <span>English</span>
                <span className="devanagari">हिन्दी</span>
                <span className="tamil">தமிழ்</span>
                <span className="bengali">বাংলা</span>
                <span className="devanagari">मराठी</span>
                <span>ગુજરાતી</span>
              </div>
            </div>
            <h3 className="feat__h">
              We refused <em>English-only</em>.
            </h3>
            <p className="feat__p">
              12 Indian languages. Switch mid-sentence — Setu follows. The maths is the same; the
              warmth comes through better in your own words.
            </p>
            <div className="feat__tags">
              <span className="feat__tag">12 languages</span>
              <span className="feat__tag">Code-switch friendly</span>
              <span className="feat__tag">Audio + text</span>
            </div>
          </article>
        </div>
      </section>

      {/* ============ JOURNEY (5 paths) ============ */}
      <section className="journey" id="paths">
        <div className="journey__head">
          <h2 className="journey__title">
            Five learners.
            <br />
            Five very different <em>paths.</em>
          </h2>
          <p className="journey__sub">
            The shape of a course should fit the shape of the learner. So Setu isn&rsquo;t one
            ladder — it&rsquo;s five, with the same Maya at the top of each.
          </p>
        </div>
        <div className="paths">
          {PATHS.map((p) => (
            <div
              key={p.num}
              className="path"
              style={
                {
                  "--hue": `var(--${p.hue})`,
                  "--hue-deep": `var(--${p.hue}-deep)`,
                  "--hue-soft": `var(--${p.hue}-soft)`,
                } as React.CSSProperties
              }
            >
              <div className="path__num"><em>{p.num}</em></div>
              <div className="path__who">
                <h3>{p.name}</h3>
                <p>{p.persona}</p>
              </div>
              <div className="path__chain">
                <div className="path__breadcrumb">
                  {p.crumbs.map((c, i) => {
                    if (c === "›") return <span key={i} className="sep">›</span>;
                    if (i === p.crumbs.length - 1) return <span key={i} className="leaf">{c}</span>;
                    return <span key={i}>{c}</span>;
                  })}
                </div>
                <div className="path__example">{p.example}</div>
              </div>
              <Link className="path__cta" href="/onboarding">
                {p.cta}
                <ArrowSvg />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ============ VOICES ============ */}
      <section className="voices">
        <div className="voices__inner">
          <h2 className="voices__title">
            Heard, in many <em>tongues.</em>
          </h2>
          <div className="voices__grid">
            {QUOTES.map((q, i) => (
              <figure key={i} className="quote">
                <div className="quote__mark">&ldquo;</div>
                <blockquote className={`quote__body${q.script ? ` ${q.script}` : ""}`}>
                  {q.body}
                </blockquote>
                <figcaption className="quote__who">
                  <div
                    className="quote__avatar"
                    style={{ ["--avatar-bg" as string]: `var(--${q.hue})` } as React.CSSProperties}
                  >
                    {q.initials}
                  </div>
                  <div>
                    <div className="quote__name">{q.name}</div>
                    <div className="quote__role">{q.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="pricing" id="pricing">
        <div className="pricing__head">
          <h2 className="pricing__title">
            Priced like a <em>chai stall.</em>
            <br />
            Felt like a private tutor.
          </h2>
          <p className="pricing__sub">
            Free to start in any of the five doorways. Pay only when Setu has earned a place in
            your routine.
          </p>
        </div>
        <div className="tiers">
          <Tier
            name="Starter"
            price="0"
            per=" / forever"
            sub="For trying it on. No card needed."
            features={[
              "Lesson 1 of every course",
              "Maya voice tutor — 15 min/day",
              "Paper-photo grading — 5/day",
              "All 12 languages",
            ]}
            ctaLabel="Start free"
            ctaHref="/onboarding"
          />
          <Tier
            featured
            badge="Most chosen"
            name="Setu Pro"
            price="299"
            per=" / month"
            sub="Everything you need to actually finish a course."
            features={[
              "Unlimited lessons across all paths",
              "Maya — unlimited, with memory",
              "Unlimited paper grading + step-by-step",
              "Adaptive drills, weekly post-mortem",
              "Offline lesson packs",
            ]}
            ctaLabel="Try Pro free for 14 days"
            ctaHref="/onboarding"
          />
          <Tier
            name="Schools & coaching"
            price="59"
            per=" / student / month"
            sub="For institutions running Setu in classrooms."
            features={[
              "Class › Subject › Bundle hierarchy",
              "Teacher dashboard + assignments",
              "Curriculum-aligned bundles (CBSE / ICSE / state)",
              "SSO, parent reports, on-prem option",
            ]}
            ctaLabel="Talk to us"
            ctaHref={SCHOOLS_MAILTO}
          />
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="endcta">
        <div className="endcta__rings" aria-hidden="true">
          <EndCtaRingsSvg />
        </div>
        <div className="endcta__inner">
          <h2 className="endcta__title">
            A bridge is only useful
            <br />
            if you <em>walk on it.</em>
          </h2>
          <p className="endcta__sub">
            Five minutes today. In your language. With Maya. We&rsquo;ll meet you on the other side.
          </p>
          <div className="endcta__row">
            <Link className="btn btn--primary" href="/onboarding">
              Start your first lesson
              <ArrowSvg />
            </Link>
            <a className="btn btn--ghost" href={SCHOOLS_MAILTO}>
              For schools &amp; coaching →
            </a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="foot">
        <div className="foot__inner">
          <div className="foot__col foot__brand">
            <Link className="brand" href="/">
              <BrandMark small />
              <span className="brand__word">ai setu<em>.</em></span>
            </Link>
            <p>
              A bridge from where you are to where you want to go. Made in India, for the world.
            </p>
          </div>
          <FooterCol title="Learners" items={["School (Class 6–12)", "College", "Competitive exams", "Professionals", "Curious minds"]} />
          <FooterCol title="Product" items={["Maya, the tutor", "Paper grading", "Languages", "Mobile app", "Changelog"]} />
          <FooterCol title="Institutions" items={["For schools", "For coaching centres", "For colleges", "Case studies"]} />
          <FooterCol title="Company" items={["About", "Careers", "Press", "Privacy", "Terms"]} />
        </div>
        <div className="foot__bottom">
          <span>© 2026 AI Setu Technologies · myaisetu.com</span>
          <span>
            <a href="#">English</a> · <a href="#">हिन्दी</a> · <a href="#">தமிழ்</a> ·{" "}
            <a href="#">বাংলা</a> · <a href="#">+9 more</a>
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─── small helpers ────────────────────────────────────────────────────

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

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="foot__col">
      <h4>{title}</h4>
      <ul>
        {items.map((it) => (
          <li key={it}>
            <a href="#">{it}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tier({
  name, price, per, sub, features, ctaLabel, ctaHref, featured, badge,
}: {
  name: string;
  price: string;
  per: string;
  sub: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  badge?: string;
}) {
  return (
    <div className={featured ? "tier tier--featured" : "tier"}>
      {badge && <div className="tier__badge">{badge}</div>}
      <div className="tier__name">{name}</div>
      <div className="tier__price">
        <span className="cur">₹</span>{price}<span className="per">{per}</span>
      </div>
      <div className="tier__sub">{sub}</div>
      <ul className="tier__list">
        {features.map((f) => (
          <li key={f}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M5 12l5 5 9-12" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <a className="tier__cta" href={ctaHref}>
        {ctaLabel}
      </a>
    </div>
  );
}

function HeroBridgeSvg() {
  return (
    <svg viewBox="0 0 540 540" fill="none">
      <ellipse cx="80" cy="270" rx="22" ry="180" fill="var(--saffron-soft)" opacity="0.6" />
      <ellipse cx="460" cy="270" rx="22" ry="180" fill="var(--plum-soft)" opacity="0.6" />
      <g transform="translate(270 270)">
        <circle r="240" stroke="var(--ink-7)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
        <circle r="200" stroke="var(--ink-7)" strokeWidth="1" strokeDasharray="2 6" fill="none" />
        <circle r="160" stroke="var(--indigo)" strokeWidth="1" strokeDasharray="3 8" fill="none" opacity="0.45">
          <animate attributeName="stroke-dashoffset" from="0" to="22" dur="9s" repeatCount="indefinite" />
        </circle>
        <circle r="120" stroke="var(--indigo)" strokeWidth="1.2" fill="none" opacity="0.55" />
        <circle r="80" stroke="var(--indigo)" strokeWidth="1.4" fill="none" opacity="0.7" />
        <circle r="44" fill="var(--indigo)" opacity="0.95" />
        <circle r="16" fill="var(--paper-pure)" />
        <circle r="6" fill="var(--saffron)" />
        <circle cx="-180" cy="-12" r="4" fill="var(--saffron)">
          <animate attributeName="cx" values="-180;180;-180" dur="14s" repeatCount="indefinite" />
          <animate attributeName="cy" values="-12;-30;-12" dur="14s" repeatCount="indefinite" />
        </circle>
        <circle cx="-180" cy="20" r="3" fill="var(--moss)">
          <animate attributeName="cx" values="-180;180;-180" dur="18s" begin="-3s" repeatCount="indefinite" />
          <animate attributeName="cy" values="20;30;20" dur="18s" repeatCount="indefinite" />
        </circle>
        <circle cx="-180" cy="-40" r="3" fill="var(--coral)">
          <animate attributeName="cx" values="-180;180;-180" dur="22s" begin="-9s" repeatCount="indefinite" />
          <animate attributeName="cy" values="-40;-20;-40" dur="22s" repeatCount="indefinite" />
        </circle>
        <circle cx="-180" cy="50" r="3.5" fill="var(--plum-glow)">
          <animate attributeName="cx" values="-180;180;-180" dur="16s" begin="-12s" repeatCount="indefinite" />
          <animate attributeName="cy" values="50;40;50" dur="16s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function EndCtaRingsSvg() {
  return (
    <svg viewBox="0 0 600 600" fill="none">
      <g transform="translate(300 300)">
        <circle r="280" stroke="var(--saffron)" strokeWidth="1" strokeDasharray="2 8" fill="none" opacity="0.4" />
        <circle r="220" stroke="var(--saffron)" strokeWidth="1" strokeDasharray="2 8" fill="none" opacity="0.5" />
        <circle r="160" stroke="var(--saffron)" strokeWidth="1.2" fill="none" opacity="0.6" />
        <circle r="100" stroke="var(--saffron)" strokeWidth="1.4" fill="none" opacity="0.8" />
        <circle r="48" fill="var(--saffron)" opacity="0.95" />
      </g>
    </svg>
  );
}

// ─── content ──────────────────────────────────────────────────────────

const AUDIENCE = [
  {
    num: "01", tag: "SCHOOL", hue: "indigo",
    title: "School student",
    sub: "From Class 6 to Class 12. CBSE, ICSE, state boards.",
    chain: ["Class", "›", "Subject", "›", "Bundle", "›", "Lesson"],
  },
  {
    num: "02", tag: "COLLEGE", hue: "moss",
    title: "College student",
    sub: "Engineering, commerce, sciences, humanities — at your own pace.",
    chain: ["Programme", "›", "Semester", "›", "Module"],
  },
  {
    num: "03", tag: "ASPIRANT", hue: "coral",
    title: "Competitive exams",
    sub: "UPSC, JEE, NEET, CAT, CLAT, banking, SSC, GATE.",
    chain: ["Exam", "›", "Section", "›", "Syllabus", "›", "Drill"],
  },
  {
    num: "04", tag: "WORK", hue: "ocean",
    title: "Working professional",
    sub: "Skill bundles for marketers, founders, engineers, teachers.",
    chain: ["Goal", "›", "Skill bundle", "›", "Lesson"],
  },
  {
    num: "05", tag: "CURIOUS", hue: "plum",
    title: "The curious one",
    sub: "Whoever just wanted to understand something today.",
    chain: ["Ask Maya", "›", "Custom path"],
  },
];

const PATHS = [
  {
    num: "01", hue: "indigo",
    name: "Aanya, 14",
    persona: "Class 9 student, Bengaluru. Likes English, hates algebra.",
    crumbs: ["Grade 9 · Sec A", "›", "Math", "›", "Algebra Foundations", "›", "Linear eq · L3"],
    example: '"Solve on paper, snap a pic — Setu shows where you went wrong."',
    cta: "For students",
  },
  {
    num: "02", hue: "moss",
    name: "Rohit, 20",
    persona: "Second-year B.Com. Wants to actually understand, not just pass.",
    crumbs: ["B.Com", "›", "Sem 4", "›", "Cost Accounting", "›", "Marginal costing"],
    example: '"Maya quizzes me on the way to college and corrects my reasoning, not just my answer."',
    cta: "For college",
  },
  {
    num: "03", hue: "coral",
    name: "Priya, 22",
    persona: "UPSC CSE 2027 aspirant, Lucknow. Day 142 of 700.",
    crumbs: ["UPSC CSE", "›", "Prelims", "›", "Polity", "›", "DPSP · drill 24"],
    example: '"Daily 30-min drills with adaptive PYQs and a Maya post-mortem on every wrong one."',
    cta: "For aspirants",
  },
  {
    num: "04", hue: "ocean",
    name: "Sameer, 34",
    persona: "Marketing manager, Pune. Has 20 minutes between meetings.",
    crumbs: ["Goal: Use AI at work", "›", "Prompt Craft", "›", "Briefing GPTs · L2"],
    example: '"Drives home listening to Maya. Voice-only mode, no screen needed."',
    cta: "For professionals",
  },
  {
    num: "05", hue: "plum",
    name: "Lata, 58",
    persona: "Schoolteacher and grandmother. Wanted to know how AI works.",
    crumbs: ["Ask Maya", "›", '"What is an LLM?"', "›", "Custom 5-min path"],
    example: '"No course, no commitment — just an answer that respected her time."',
    cta: "For everyone",
  },
];

const QUOTES = [
  {
    body: "सेतु पर मैंने पहली बार समझा कि equations सिर्फ रटने की चीज़ नहीं हैं। माया दीदी जैसे समझाती है, घर पर कोई नहीं समझाता।",
    script: "devanagari",
    initials: "AK", hue: "indigo",
    name: "Ananya K.",
    role: "CLASS 9 · LUCKNOW",
  },
  {
    body: "I solved problems on paper for fifteen years before this app. It's the first one that didn't ask me to retype everything.",
    initials: "RS", hue: "moss",
    name: "Ravi S.",
    role: "JEE ASPIRANT · KOTA",
  },
  {
    body: "என் அப்பாவுக்கு tech என்றால் பயம். Setu-வில் தமிழில் பேசினார், மாயா பதிலளித்தாள். அவ்வளவு தான்.",
    script: "tamil",
    initials: "DM", hue: "plum",
    name: "Divya M.",
    role: "DEVELOPER · CHENNAI",
  },
  {
    body: "We piloted Setu in two sections of Class 8. Homework completion went from 41% to 86% in three weeks. The voice tutor changed everything for our slower students.",
    initials: "PR", hue: "coral",
    name: "Mrs. Padma R.",
    role: "PRINCIPAL · DPS HYDERABAD",
  },
  {
    body: "অফিস যেতে যেতে শুনি, রাতে কাগজে লিখে practice করি। আমার মতো adult learner-দের জন্য এটাই দরকার ছিল।",
    script: "bengali",
    initials: "SD", hue: "ocean",
    name: "Suman D.",
    role: "DESIGNER · KOLKATA",
  },
  {
    body: "For 700-day prep, the post-mortem on every wrong answer is what compounds. I see my own bias — and Maya remembers it for me.",
    initials: "KN", hue: "saffron",
    name: "Kabir N.",
    role: "UPSC ASPIRANT · DELHI",
  },
];
