// /join — the quiz funnel.
//
// Public lander. No auth gate at entry — the page IS where
// Meta / YouTube / Google traffic drops. Sign-in is auto-triggered
// behind the scenes after submit (Supabase admin generateLink →
// our /auth/callback → user is signed in by the time they hit
// Cashfree).
//
// Single-page form, server-rendered with a server action so it
// works even when JS hasn't hydrated yet (great for slow phones
// + ad traffic). State + branching happens in submitQuizAction.

import type { Metadata } from "next";
import Link from "next/link";

import "@/app/landing.css";
import { submitQuizAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join AI Setu · Class 6–10 students",
  description:
    "Two-minute quiz. Then a Maya-powered curriculum personalised for your class, board, and language. ₹199/month.",
};

// Form options live here so the page renders fast and the loader
// stays small. None of these change at runtime.
const CLASSES = [
  { value: "6", label: "Class 6" },
  { value: "7", label: "Class 7" },
  { value: "8", label: "Class 8" },
  { value: "9", label: "Class 9" },
  { value: "10", label: "Class 10" },
  { value: "11", label: "Class 11" },
  { value: "12", label: "Class 12" },
  { value: "college", label: "College" },
  { value: "other", label: "Other" },
];

const BOARDS = [
  { value: "cbse", label: "CBSE" },
  { value: "icse", label: "ICSE" },
  { value: "state", label: "State Board" },
  { value: "ib", label: "IB" },
  { value: "cambridge", label: "Cambridge (IGCSE)" },
  { value: "other", label: "Other" },
];

const BOARD_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "gu", label: "ગુજરાતી (Gujarati)" },
  { value: "kn", label: "ಕನ್ನಡ (Kannada)" },
  { value: "ml", label: "മലയാളം (Malayalam)" },
  { value: "ur", label: "اردو (Urdu)" },
];

const PREFERRED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "hinglish", label: "Hinglish" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { value: "fr", label: "Français (French)" },
  { value: "es", label: "Español (Spanish)" },
];

const SUBJECTS = [
  { value: "math", label: "Math" },
  { value: "science", label: "Science" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "social-science", label: "Social Science" },
  { value: "computer-science", label: "Computer Science" },
  { value: "sanskrit", label: "Sanskrit" },
  { value: "other", label: "Other" },
];

export default function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  return <JoinView searchParamsPromise={searchParams} />;
}

async function JoinView({
  searchParamsPromise,
}: {
  searchParamsPromise?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParamsPromise) ?? {};
  const error = sp.error;

  return (
    <div className="landing">
      <main
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "40px 24px 80px",
        }}
      >
        {/* Brand mark — light, no nav. Ad traffic doesn't get a nav. */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: "var(--ink)",
          }}
        >
          <svg viewBox="0 0 40 40" width={28} height={28} fill="none">
            <circle cx="20" cy="20" r="18" stroke="var(--ink)" strokeWidth={1.5} />
            <circle cx="20" cy="20" r="11" stroke="var(--ink)" strokeWidth={1.5} opacity={0.5} />
            <circle cx="20" cy="20" r="5" fill="var(--indigo)" />
          </svg>
          <span
            className="lm-serif"
            style={{ fontSize: 18, letterSpacing: "-0.02em", fontWeight: 500 }}
          >
            ai setu<em style={{ fontStyle: "italic", color: "var(--indigo)" }}>.</em>
          </span>
        </Link>

        <header style={{ marginTop: 40 }}>
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
            Two minutes · Then your dashboard
          </p>
          <h1
            className="lm-serif"
            style={{
              fontSize: "clamp(34px, 5vw, 52px)",
              lineHeight: 1.05,
              fontWeight: 300,
              color: "var(--ink)",
              margin: 0,
              letterSpacing: "-0.025em",
            }}
          >
            Let&rsquo;s set up your <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>Maya</em>.
          </h1>
          <p
            className="lm-serif"
            style={{
              marginTop: 14,
              fontStyle: "italic",
              fontSize: 17,
              lineHeight: 1.45,
              color: "var(--text-2)",
              maxWidth: 540,
            }}
          >
            We&rsquo;ll use your answers to personalise the chapters, the language, and the
            subjects Maya focuses on. Class 6–10 plans are ₹199/month, all subjects.
          </p>
        </header>

        {error && <ErrorBanner message={decodeURIComponent(error)} />}

        <form
          action={submitQuizAction}
          style={{
            marginTop: 36,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <Field label="Your first name" hint="So Maya knows what to call you.">
            <input
              type="text"
              name="first_name"
              required
              maxLength={60}
              autoComplete="given-name"
              className="lm-input"
              placeholder="e.g. Aanya"
            />
          </Field>

          <Field label="Email" hint="We'll send your dashboard link here.">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="lm-input"
              placeholder="you@example.com"
            />
          </Field>

          <Field label="City">
            <input
              type="text"
              name="city"
              required
              maxLength={80}
              autoComplete="address-level2"
              className="lm-input"
              placeholder="e.g. Bengaluru"
            />
          </Field>

          <Field label="Which class are you in?">
            <select name="school_class" required className="lm-input">
              <option value="">Select your class</option>
              {CLASSES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Your education board">
            <select name="education_board" required className="lm-input">
              <option value="">Select your board</option>
              {BOARDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Primary language of your board"
            hint="The language your school teaches in."
          >
            <select name="board_language" required className="lm-input" defaultValue="en">
              {BOARD_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Preferred language for Maya"
            hint="Maya will speak and write to you in this language."
          >
            <select name="preferred_language" required className="lm-input" defaultValue="en">
              {PREFERRED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Which subjects do you struggle with?"
            hint="Pick all that apply. We'll focus practice here first."
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 8,
                marginTop: 4,
              }}
            >
              {SUBJECTS.map((s) => (
                <label
                  key={s.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-2)",
                    cursor: "pointer",
                    fontSize: 14,
                    background: "var(--paper-pure)",
                  }}
                >
                  <input
                    type="checkbox"
                    name="struggle_subjects"
                    value={s.value}
                    style={{ accentColor: "var(--indigo)" }}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>

          <button
            type="submit"
            className="btn btn--primary"
            style={{
              marginTop: 12,
              padding: "16px 24px",
              fontSize: 16,
              alignSelf: "stretch",
              justifyContent: "center",
            }}
          >
            Continue → ₹199/month plan
          </button>

          <p
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              textAlign: "center",
              marginTop: -4,
              lineHeight: 1.5,
            }}
          >
            By continuing you agree to our terms. Class 6–10 plans go to a Cashfree
            payment page. Other classes — we&rsquo;ll email you when content for your
            grade is ready.
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--ink)",
          letterSpacing: "-0.005em",
        }}
      >
        {label}
      </span>
      {hint && (
        <span
          style={{
            fontSize: 12.5,
            color: "var(--text-3)",
            lineHeight: 1.4,
            marginBottom: 2,
          }}
        >
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: "12px 16px",
        background: "var(--coral-soft)",
        border: "1px solid var(--coral)",
        borderRadius: "var(--r-2)",
        color: "var(--coral-deep)",
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      {message}
    </div>
  );
}
