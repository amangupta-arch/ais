"use client";

// Interactive one-question-per-screen quiz funnel. Coursiv / MyIQ /
// Octane style. Each step is one motion.div; framer-motion slides
// the next one in. Quiz answers accumulate in component state AND
// localStorage on every step — so the user can survive a tab
// refresh, and the post-auth /join/finalize page picks them back
// up after sign-in.
//
// Sign-in happens on the last step via Google, email + password, or
// mobile + OTP. (Magic-link sign-in was retired.) No price shown
// anywhere inside the funnel; ₹199/month is only visible on the
// Cashfree hosted checkout page.

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { createClient } from "@/lib/supabase/browser";

const LS_KEY = "ais.pending-quiz";

type QuizData = {
  firstName?: string;
  city?: string;
  schoolClass?: string;
  educationBoard?: string;
  stateBoard?: string;
  boardLanguage?: string;
  preferredLanguage?: string;
  struggleSubjects?: string[];
};

type Option = { value: string; label: string; hint?: string };

const CLASS_OPTIONS: Option[] = [
  { value: "6", label: "Class 6" },
  { value: "7", label: "Class 7" },
  { value: "8", label: "Class 8" },
  { value: "9", label: "Class 9" },
  { value: "10", label: "Class 10" },
  { value: "11", label: "Class 11" },
  { value: "12", label: "Class 12" },
  { value: "college", label: "College" },
  { value: "other", label: "Something else" },
];

const BOARD_OPTIONS: Option[] = [
  { value: "cbse", label: "CBSE" },
  { value: "icse", label: "ICSE" },
  { value: "state", label: "State Board" },
  { value: "ib", label: "IB" },
  { value: "cambridge", label: "Cambridge (IGCSE)" },
  { value: "other", label: "Other" },
];

// Major Indian state boards. Slug-shaped values so they pass the
// profiles.state_board check constraint. "Other" is a catch-all for
// the smaller / UT boards we haven't enumerated.
const STATE_BOARD_OPTIONS: Option[] = [
  { value: "maharashtra", label: "Maharashtra (MSBSHSE)" },
  { value: "up", label: "Uttar Pradesh (UPMSP)" },
  { value: "bihar", label: "Bihar (BSEB)" },
  { value: "west-bengal", label: "West Bengal (WBBSE)" },
  { value: "tamil-nadu", label: "Tamil Nadu" },
  { value: "andhra-pradesh", label: "Andhra Pradesh (BSEAP)" },
  { value: "telangana", label: "Telangana" },
  { value: "karnataka", label: "Karnataka (KSEEB)" },
  { value: "kerala", label: "Kerala (SCERT)" },
  { value: "rajasthan", label: "Rajasthan (RBSE)" },
  { value: "madhya-pradesh", label: "Madhya Pradesh (MPBSE)" },
  { value: "gujarat", label: "Gujarat (GSEB)" },
  { value: "punjab", label: "Punjab (PSEB)" },
  { value: "haryana", label: "Haryana (BSEH)" },
  { value: "odisha", label: "Odisha (BSE)" },
  { value: "chhattisgarh", label: "Chhattisgarh (CGBSE)" },
  { value: "jharkhand", label: "Jharkhand (JAC)" },
  { value: "assam", label: "Assam (SEBA)" },
  { value: "uttarakhand", label: "Uttarakhand (UBSE)" },
  { value: "himachal-pradesh", label: "Himachal Pradesh (HPBOSE)" },
  { value: "jammu-kashmir", label: "J&K (JKBOSE)" },
  { value: "goa", label: "Goa (GBSHSE)" },
  { value: "other", label: "Other state board" },
];

const BOARD_LANGUAGE_OPTIONS: Option[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "mr", label: "मराठी" },
  { value: "ta", label: "தமிழ்" },
  { value: "te", label: "తెలుగు" },
  { value: "bn", label: "বাংলা" },
  { value: "pa", label: "ਪੰਜਾਬੀ" },
  { value: "gu", label: "ગુજરાતી" },
  { value: "kn", label: "ಕನ್ನಡ" },
  { value: "ml", label: "മലയാളം" },
  { value: "ur", label: "اردو" },
];

const PREFERRED_LANGUAGE_OPTIONS: Option[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hinglish", label: "Hinglish" },
  { value: "mr", label: "मराठी" },
  { value: "ta", label: "தமிழ்" },
  { value: "te", label: "తెలుగు" },
  { value: "bn", label: "বাংলা" },
  { value: "pa", label: "ਪੰਜਾਬੀ" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const SUBJECT_OPTIONS: Option[] = [
  { value: "math", label: "Math" },
  { value: "science", label: "Science" },
  { value: "english", label: "English" },
  { value: "hindi", label: "Hindi" },
  { value: "social-science", label: "Social Science" },
  { value: "computer-science", label: "Computer Science" },
  { value: "sanskrit", label: "Sanskrit" },
  { value: "other", label: "Something else" },
];

// 7 questions, then a curating screen, then a sign-in screen.
// Progress bar shows questions only — curating + sign-in are
// treated as flow steps, not survey steps. The state-board
// sub-picker on step 3 doesn't move the step counter; it's a
// sub-screen of the same question.
const TOTAL_QUESTIONS = 7;

export default function JoinQuiz({
  initialError = null,
}: {
  // Forwarded from app/join/page.tsx searchParams.error — surfaces
  // the "Please restart the quiz" message and any future bounce-back
  // errors. Informational only; we still always boot at step 0.
  initialError?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuizData>({});
  const [hydrated, setHydrated] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(initialError);

  // Rehydrate from localStorage on mount so a refresh doesn't
  // dump the user back to step 1. Only used as an extra-resilience
  // backup — the more common case is "fresh visit, empty data".
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch {
      /* ignore — localStorage can be disabled */
    }
    setHydrated(true);
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, hydrated]);

  const updateField = <K extends keyof QuizData>(key: K, value: QuizData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // On step 3 with educationBoard === 'state' and stateBoard unset,
  // "back" should clear the board choice and drop us back to the
  // CBSE/ICSE/State picker, not jump back to the city question.
  const goBack = () => {
    if (step === 3 && data.educationBoard === "state" && !data.stateBoard) {
      setData((prev) => ({ ...prev, educationBoard: undefined }));
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  };
  const goNext = () => setStep((s) => s + 1);

  return (
    <div className="join-shell">
      <Header step={step} total={TOTAL_QUESTIONS} onBack={goBack} />

      {errorBanner && (
        <div
          role="alert"
          className="join-error"
          style={{
            margin: "0 24px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ flex: 1 }}>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss"
            style={{
              background: "transparent",
              border: 0,
              color: "inherit",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
      )}

      <main className="join-stage">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <Step key={0}>
              <TextQuestion
                title="What's your first name?"
                helper="So we can address you properly."
                placeholder="e.g. Aanya"
                value={data.firstName ?? ""}
                onChange={(v) => updateField("firstName", v)}
                onContinue={goNext}
              />
            </Step>
          )}
          {step === 1 && (
            <Step key={1}>
              <TextQuestion
                title={`Which city, ${first(data.firstName)}?`}
                helper="We use this for examples — local cricket teams, your zone of weather, that kind of thing."
                placeholder="e.g. Bengaluru"
                value={data.city ?? ""}
                onChange={(v) => updateField("city", v)}
                onContinue={goNext}
              />
            </Step>
          )}
          {step === 2 && (
            <Step key={2}>
              <OptionsQuestion
                title="Which class are you in right now?"
                options={CLASS_OPTIONS}
                value={data.schoolClass}
                onChange={(v) => {
                  updateField("schoolClass", v);
                  setTimeout(goNext, 220);
                }}
              />
            </Step>
          )}
          {step === 3 && data.educationBoard !== "state" && (
            <Step key="board-main">
              <OptionsQuestion
                title="Which board does your school follow?"
                options={BOARD_OPTIONS}
                value={data.educationBoard}
                onChange={(v) => {
                  updateField("educationBoard", v);
                  // For "state" we stay on this step and render the
                  // state board sub-picker on the next render. Every
                  // other board advances immediately.
                  if (v !== "state") setTimeout(goNext, 220);
                }}
              />
            </Step>
          )}
          {step === 3 && data.educationBoard === "state" && (
            <Step key="board-state">
              <OptionsQuestion
                title="Which state board?"
                helper="Pick the board your school follows."
                options={STATE_BOARD_OPTIONS}
                value={data.stateBoard}
                gridCols={2}
                onChange={(v) => {
                  updateField("stateBoard", v);
                  setTimeout(goNext, 220);
                }}
              />
            </Step>
          )}
          {step === 4 && (
            <Step key={4}>
              <OptionsQuestion
                title="What language does your school teach in?"
                helper="The medium of instruction — usually English, Hindi, or a regional language."
                options={BOARD_LANGUAGE_OPTIONS}
                value={data.boardLanguage}
                gridCols={3}
                onChange={(v) => {
                  updateField("boardLanguage", v);
                  setTimeout(goNext, 220);
                }}
              />
            </Step>
          )}
          {step === 5 && (
            <Step key={5}>
              <OptionsQuestion
                title="Which language should your tutor use?"
                helper="You can switch later from your profile."
                options={PREFERRED_LANGUAGE_OPTIONS}
                value={data.preferredLanguage}
                gridCols={3}
                onChange={(v) => {
                  updateField("preferredLanguage", v);
                  setTimeout(goNext, 220);
                }}
              />
            </Step>
          )}
          {step === 6 && (
            <Step key={6}>
              <MultiOptionsQuestion
                title="Which subjects do you find hardest?"
                helper="Pick all that apply. We'll start your practice here."
                options={SUBJECT_OPTIONS}
                values={data.struggleSubjects ?? []}
                onChange={(vs) => updateField("struggleSubjects", vs)}
                onContinue={goNext}
              />
            </Step>
          )}
          {step === 7 && (
            <Step key={7}>
              <Curating
                onDone={goNext}
                firstName={first(data.firstName)}
              />
            </Step>
          )}
          {step === 8 && (
            <Step key={8}>
              <SignIn firstName={first(data.firstName)} />
            </Step>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── chrome ───────────────────────────────────────────────────────────

function Header({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack: () => void;
}) {
  // Curating + sign-in are flow steps, not survey steps — show
  // a static label instead of a moving fraction.
  const isCurating = step === total;
  const isSignin = step === total + 1;
  const surveyPct = isCurating || isSignin ? 100 : Math.round(((step + 1) / total) * 100);
  const showBack = step > 0 && !isCurating;

  return (
    <header className="join-header">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="join-header__back"
        style={{ visibility: showBack ? "visible" : "hidden" }}
      >
        <ArrowLeft size={18} />
      </button>

      <div className="join-header__progress">
        <div
          className="join-header__progress-fill"
          style={{ width: `${surveyPct}%` }}
        />
      </div>

      <div className="join-header__count">
        {isCurating ? "•••" : isSignin ? "Last step" : `${step + 1} / ${total}`}
      </div>
    </header>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      className="join-step"
    >
      {children}
    </motion.div>
  );
}

// ─── question types ──────────────────────────────────────────────────

function TextQuestion({
  title,
  helper,
  placeholder,
  value,
  onChange,
  onContinue,
}: {
  title: string;
  helper?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onContinue: () => void;
}) {
  const valid = value.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onContinue();
      }}
      className="join-question"
    >
      <h1 className="join-question__title">{title}</h1>
      {helper && <p className="join-question__helper">{helper}</p>}
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className="join-input"
      />
      <button type="submit" className="join-btn" disabled={!valid}>
        Continue <ArrowRight size={16} />
      </button>
    </form>
  );
}

function OptionsQuestion({
  title,
  helper,
  options,
  value,
  onChange,
  gridCols,
}: {
  title: string;
  helper?: string;
  options: Option[];
  value: string | undefined;
  onChange: (v: string) => void;
  gridCols?: number;
}) {
  return (
    <div className="join-question">
      <h1 className="join-question__title">{title}</h1>
      {helper && <p className="join-question__helper">{helper}</p>}
      <div
        className="join-options"
        style={{
          gridTemplateColumns: gridCols
            ? `repeat(${gridCols}, minmax(0, 1fr))`
            : undefined,
        }}
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`join-option ${active ? "is-active" : ""}`}
            >
              <span>{opt.label}</span>
              {active && <Check size={16} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiOptionsQuestion({
  title,
  helper,
  options,
  values,
  onChange,
  onContinue,
}: {
  title: string;
  helper?: string;
  options: Option[];
  values: string[];
  onChange: (vs: string[]) => void;
  onContinue: () => void;
}) {
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div className="join-question">
      <h1 className="join-question__title">{title}</h1>
      {helper && <p className="join-question__helper">{helper}</p>}
      <div
        className="join-options"
        style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
      >
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className={`join-option ${active ? "is-active" : ""}`}
            >
              <span>{opt.label}</span>
              {active && <Check size={16} />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="join-btn"
        disabled={values.length === 0}
      >
        Continue <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─── interstitials ───────────────────────────────────────────────────

function Curating({ onDone, firstName }: { onDone: () => void; firstName: string }) {
  const lines = useMemo(
    () => [
      "Listening to your answers…",
      "Finding the right teacher voice…",
      "Picking your first lesson…",
      `Ready, ${firstName}.`,
    ],
    [firstName],
  );

  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    if (lineIdx >= lines.length - 1) {
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLineIdx((i) => i + 1), 900);
    return () => clearTimeout(t);
  }, [lineIdx, lines.length, onDone]);

  return (
    <div className="join-curating">
      <div className="join-curating__orb">
        <span />
        <span />
        <span />
      </div>
      <h2 className="join-curating__title">Crafting your plan</h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={lineIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.32 }}
          className="join-curating__line"
        >
          {lines[lineIdx]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ─── sign-in step ────────────────────────────────────────────────────

type SignInMode = "choose" | "email" | "phone" | "otp";

function SignIn({ firstName }: { firstName: string }) {
  const [mode, setMode] = useState<SignInMode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Email + password (single field, signs in if user exists; signs
  // up otherwise).
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Phone OTP — phone holds the raw 10-digit number, we always send
  // with the +91 prefix to Supabase.
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  // After verifyOtp / signUp succeeds with a session we route to
  // /join/finalize. If signUp returns no session (Supabase has email
  // confirmations on), we surface a "check your email" screen.
  const [pendingEmailConfirm, setPendingEmailConfirm] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const NEXT = "/join/finalize";
  const finishWithSession = () => {
    window.location.href = NEXT;
  };

  // Google: Supabase OAuth. The redirectTo lands on /auth/callback →
  // /join/finalize, which reads the localStorage quiz and writes
  // the profile, then routes by class.
  const signInWithGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(NEXT)}`,
        },
      });
      if (error) throw error;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Google sign-in failed.");
    }
  };

  // Single screen for email + password. Try signing in first; if
  // the user doesn't exist (or password is wrong on a brand-new
  // address), fall back to signUp. This collapses the sign-in /
  // sign-up split into one continue button.
  const continueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const signIn = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signIn.data.session) {
        finishWithSession();
        return;
      }
      // signIn failed — try signUp. If the user genuinely had the
      // wrong password we'll catch the duplicate-email error here.
      const signUp = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (signUp.error) {
        // "User already registered" → the address exists, the
        // password was just wrong. Tell them that, not "signup
        // failed".
        const msg = signUp.error.message.toLowerCase();
        if (msg.includes("already")) {
          throw new Error("That email is registered — check the password and try again.");
        }
        throw signUp.error;
      }
      if (signUp.data.session) {
        finishWithSession();
        return;
      }
      // No session means Supabase is set to require email
      // confirmation. Show the inbox screen.
      setPendingEmailConfirm(true);
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't sign you in. Try again.");
    }
  };

  // Phone + OTP. signInWithOtp({phone}) provisions a user if
  // they're new and texts them a code. verifyOtp({phone, token,
  // type: 'sms'}) completes the session.
  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, "");
      if (!/^[6-9]\d{9}$/.test(digits)) {
        throw new Error("Enter a 10-digit Indian mobile number.");
      }
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${digits}`,
      });
      if (error) {
        // Most likely cause in production: SMS provider isn't
        // wired up in the Supabase dashboard yet. Surface a
        // gentler fallback message.
        const msg = error.message.toLowerCase();
        if (msg.includes("phone") && msg.includes("not")) {
          throw new Error("Mobile sign-in isn't enabled yet — please use Google or email.");
        }
        throw error;
      }
      setMode("otp");
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't send the code. Try again.");
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, "");
      const token = otp.replace(/\D/g, "");
      if (token.length !== 6) {
        throw new Error("Enter the 6-digit code we sent you.");
      }
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${digits}`,
        token,
        type: "sms",
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error("Couldn't complete sign-in. Try requesting a new code.");
      }
      finishWithSession();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Couldn't verify the code. Try again.");
    }
  };

  // ─── render ────────────────────────────────────────────────────

  if (pendingEmailConfirm) {
    return (
      <div className="join-signin">
        <h1 className="join-question__title">
          Check your <em style={{ color: "var(--indigo)" }}>inbox</em>.
        </h1>
        <p className="join-question__helper">
          We sent a confirmation link to <strong>{email}</strong>. Tap it to
          finish signing in.
        </p>
      </div>
    );
  }

  const helperText =
    mode === "email"
      ? "We'll sign you in if your email is already registered, or create your account if it's new."
      : mode === "phone"
      ? "We'll text you a 6-digit code to sign in."
      : mode === "otp"
      ? `Enter the 6-digit code we sent to +91 ${phone}.`
      : "Pick a method to save your quiz answers and unlock your dashboard.";

  return (
    <div className="join-signin">
      <h1 className="join-question__title">
        You&rsquo;re in, {firstName}.
        <br />
        <span style={{ color: "var(--indigo)", fontStyle: "italic" }}>
          Save your plan.
        </span>
      </h1>
      <p className="join-question__helper">{helperText}</p>

      {mode === "choose" && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="join-btn join-btn--google"
          >
            <GoogleIcon />
            {busy ? "Opening Google…" : "Continue with Google"}
          </button>

          <div className="join-divider">
            <span />
            or
            <span />
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("email");
            }}
            disabled={busy}
            className="join-btn join-btn--secondary"
          >
            Continue with email
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode("phone");
            }}
            disabled={busy}
            className="join-btn join-btn--secondary"
            style={{ marginTop: 10 }}
          >
            Continue with mobile
          </button>
        </>
      )}

      {mode === "email" && (
        <form onSubmit={continueWithEmail} className="join-email">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            autoComplete="email"
            className="join-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="Password (min 8 characters)"
            autoComplete="current-password"
            className="join-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 10 }}
          />
          <button
            type="submit"
            disabled={busy || password.length < 8}
            className="join-btn"
            style={{ marginTop: 12 }}
          >
            {busy ? "Signing you in…" : "Continue"}
          </button>
          <button
            type="button"
            onClick={() => setMode("choose")}
            disabled={busy}
            className="join-link"
          >
            ← other sign-in options
          </button>
        </form>
      )}

      {mode === "phone" && (
        <form onSubmit={sendOtp} className="join-email">
          <div className="join-phone">
            <span className="join-phone__prefix">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              required
              placeholder="10-digit mobile"
              className="join-input join-phone__input"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <button
            type="submit"
            disabled={busy || !/^[6-9]\d{9}$/.test(phone)}
            className="join-btn"
            style={{ marginTop: 12 }}
          >
            {busy ? "Sending code…" : "Send code"}
          </button>
          <button
            type="button"
            onClick={() => setMode("choose")}
            disabled={busy}
            className="join-link"
          >
            ← other sign-in options
          </button>
        </form>
      )}

      {mode === "otp" && (
        <form onSubmit={verifyOtp} className="join-email">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="6-digit code"
            className="join-input"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            style={{
              letterSpacing: "0.4em",
              textAlign: "center",
              fontSize: 22,
            }}
          />
          <button
            type="submit"
            disabled={busy || otp.length !== 6}
            className="join-btn"
            style={{ marginTop: 12 }}
          >
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtp("");
              setMode("phone");
            }}
            disabled={busy}
            className="join-link"
          >
            ← change number
          </button>
        </form>
      )}

      {error && <p className="join-error">{error}</p>}

      <p className="join-fine-print">
        We&rsquo;ll save your quiz answers and personalise your plan. Class 6–10
        learners go to a Cashfree payment page. Other classes — we&rsquo;ll
        email you when we go live.
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.05-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.89 2.69-6.63Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.8.54-1.83.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.05l3.05-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function first(s?: string): string {
  if (!s) return "friend";
  const trimmed = s.trim();
  if (!trimmed) return "friend";
  return trimmed.split(/\s+/)[0]!;
}
