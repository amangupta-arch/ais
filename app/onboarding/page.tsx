"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { OptionCard } from "@/components/ui/OptionCard";
import { createClient } from "@/lib/supabase/browser";
import {
  CURRENT_LEVEL_OPTIONS,
  DAILY_GOAL_OPTIONS,
  GENERATING_LINES,
  INTEREST_OPTIONS,
  LANGUAGE_OPTIONS,
  OnboardingAnswers,
  PENDING_KEY,
  PRIMARY_GOAL_OPTIONS,
  REVEAL_LINES_BY_GOAL,
  ROLE_OPTIONS,
  STORAGE_KEY,
} from "@/lib/onboarding";
import type {
  CurrentLevel, DailyGoalMinutes, Interest, PreferredLanguage, PrimaryGoal, UserRole,
} from "@/lib/types";

type StepId =
  | "welcome" | "name" | "goal" | "level" | "role"
  | "interests" | "language" | "daily" | "generating" | "reveal";

const ORDER: StepId[] = [
  "welcome", "name", "goal", "level", "role",
  "interests", "language", "daily", "generating", "reveal",
];

const STEP_NUMBER: Partial<Record<StepId, string>> = {
  name: "01", goal: "02", level: "03", role: "04",
  interests: "05", language: "06", daily: "07",
};

const stepVariants = {
  enter:  { opacity: 0, y: 6 },
  center: { opacity: 1, y: 0 },
  exit:   { opacity: 0, y: -6 },
};

export default function OnboardingPage() {
  const [step, setStep] = useState<StepId>("welcome");
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setAnswers(JSON.parse(raw)); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  const goTo = useCallback((next: StepId) => setStep(next), []);

  const advance = useCallback(() => {
    const idx = ORDER.indexOf(step);
    const next = ORDER[Math.min(idx + 1, ORDER.length - 1)];
    if (next) setStep(next);
  }, [step]);

  const back = useCallback(() => {
    const idx = ORDER.indexOf(step);
    if (idx <= 1) return;
    const prev = ORDER[idx - 1];
    if (prev) setStep(prev);
  }, [step]);

  const update = useCallback((patch: Partial<OnboardingAnswers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
  }, []);

  const stepIndex = ORDER.indexOf(step);
  const canBack = stepIndex >= 2 && step !== "generating" && step !== "reveal";

  const progressPct = useMemo(() => {
    const quizSteps: StepId[] = ["name", "goal", "level", "role", "interests", "language", "daily"];
    const i = quizSteps.indexOf(step);
    if (i === -1) {
      if (step === "welcome") return 0;
      if (step === "generating") return 100;
      if (step === "reveal") return 100;
      return 0;
    }
    return Math.round(((i + 1) / quizSteps.length) * 100);
  }, [step]);

  const handleSendMagicLink = async () => {
    setEmailState("sending");
    setEmailError(null);
    try {
      const supabase = createClient();
      localStorage.setItem(PENDING_KEY, JSON.stringify(answers));
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding/complete`,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setEmailState("sent");
    } catch (err) {
      setEmailState("error");
      setEmailError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  };

  return (
    <main className="lm-page flex flex-col">
      <div
        className="mx-auto flex flex-col"
        style={{ maxWidth: 640, padding: "24px 24px 96px", flex: 1, width: "100%" }}
      >
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
          <div className="flex items-center" style={{ gap: 12 }}>
            {canBack ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center"
                style={{
                  gap: 4,
                  fontSize: 13,
                  color: "var(--text-2)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <ArrowLeft className="h-4 w-4" /> back
              </button>
            ) : null}
            <div
              className="lm-mono lm-tabular hidden sm:block"
              style={{ fontSize: 11, color: "var(--text-3)" }}
            >
              {progressPct}%
            </div>
          </div>
        </header>

        {stepIndex >= 1 && stepIndex <= 7 ? (
          <div className="lm-progress" style={{ marginTop: 16, height: 4 }}>
            <motion.div
              className="lm-progress__fill"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          </div>
        ) : null}

        <div className="flex-1 flex flex-col justify-center" style={{ padding: "40px 0" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {step === "welcome" && <StepWelcome onStart={advance} />}

              {step === "name" && (
                <StepName
                  number={STEP_NUMBER.name!}
                  value={answers.displayName ?? ""}
                  onChange={(v) => update({ displayName: v })}
                  onContinue={advance}
                />
              )}

              {step === "goal" && (
                <StepSingle<PrimaryGoal>
                  number={STEP_NUMBER.goal!}
                  title="Why are you here?"
                  options={PRIMARY_GOAL_OPTIONS.map((o) => ({
                    id: o.id, title: o.title, blurb: o.blurb, emoji: o.emoji,
                  }))}
                  value={answers.primaryGoal}
                  onPick={(v) => { update({ primaryGoal: v }); setTimeout(advance, 220); }}
                />
              )}

              {step === "level" && (
                <StepSingle<CurrentLevel>
                  number={STEP_NUMBER.level!}
                  title="How much AI have you actually used?"
                  options={CURRENT_LEVEL_OPTIONS.map((o) => ({
                    id: o.id, title: o.title, blurb: o.blurb,
                  }))}
                  value={answers.currentLevel}
                  onPick={(v) => { update({ currentLevel: v }); setTimeout(advance, 220); }}
                />
              )}

              {step === "role" && (
                <StepSingle<UserRole>
                  number={STEP_NUMBER.role!}
                  title="What do you spend your days on?"
                  options={ROLE_OPTIONS.map((o) => ({
                    id: o.id, title: o.title, emoji: o.emoji,
                  }))}
                  value={answers.role}
                  onPick={(v) => { update({ role: v }); setTimeout(advance, 220); }}
                />
              )}

              {step === "interests" && (
                <StepMulti
                  number={STEP_NUMBER.interests!}
                  value={answers.interests ?? []}
                  onChange={(v) => update({ interests: v })}
                  onContinue={advance}
                />
              )}

              {step === "language" && (
                <StepSingle<PreferredLanguage>
                  number={STEP_NUMBER.language!}
                  title="Language you think in?"
                  options={LANGUAGE_OPTIONS.map((o) => ({
                    id: o.id, title: o.title, blurb: o.blurb,
                  }))}
                  value={answers.preferredLanguage}
                  onPick={(v) => { update({ preferredLanguage: v }); setTimeout(advance, 220); }}
                />
              )}

              {step === "daily" && (
                <StepDaily
                  number={STEP_NUMBER.daily!}
                  value={answers.dailyGoalMinutes}
                  onPick={(v) => { update({ dailyGoalMinutes: v }); setTimeout(advance, 220); }}
                />
              )}

              {step === "generating" && <StepGenerating onDone={() => goTo("reveal")} />}

              {step === "reveal" && (
                <StepReveal
                  answers={answers}
                  email={email}
                  emailState={emailState}
                  emailError={emailError}
                  onEmailChange={setEmail}
                  onSubmit={handleSendMagicLink}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ Steps */

function StepHeading({ number, eyebrow, children }: { number?: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <>
      <p className="lm-eyebrow">
        {number ? <span className="lm-tabular" style={{ marginRight: 8 }}>{number}</span> : null}
        {eyebrow}
      </p>
      <h1
        className="lm-serif"
        style={{
          marginTop: 8,
          fontSize: 36,
          lineHeight: 1.1,
          color: "var(--text)",
        }}
      >
        {children}
      </h1>
    </>
  );
}

function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <p className="lm-eyebrow">
        <span className="lm-tabular" style={{ marginRight: 8 }}>00</span>
        before we begin
      </p>
      <h1
        className="lm-serif"
        style={{ marginTop: 12, fontSize: 48, lineHeight: 1.05, color: "var(--text)" }}
      >
        A few <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>questions</em>.
      </h1>
      <p
        style={{
          marginTop: 20,
          maxWidth: 480,
          fontSize: 16,
          lineHeight: 1.55,
          color: "var(--text-2)",
        }}
      >
        Seven of them, about 90 seconds. We&apos;ll show you a plan — and then,
        if it&apos;s right, you tell us where to send it.
      </p>
      <div style={{ marginTop: 32 }}>
        <button type="button" className="lm-btn lm-btn--accent lm-btn--lg" onClick={onStart}>
          Start <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepName({
  number, value, onChange, onContinue,
}: { number: string; value: string; onChange: (v: string) => void; onContinue: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const canContinue = value.trim().length >= 1;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canContinue) onContinue(); }}>
      <StepHeading number={number} eyebrow="your name">What should we call you?</StepHeading>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="First name is fine"
        style={{
          marginTop: 32,
          width: "100%",
          background: "transparent",
          border: 0,
          borderBottom: "2px solid var(--border-strong)",
          padding: "8px 0",
          fontSize: 28,
          fontWeight: 600,
          fontFamily: "var(--font-fraunces), Georgia, serif",
          color: "var(--text)",
          outline: "none",
          transition: "border-color 160ms cubic-bezier(0.2,0,0,1)",
        }}
        onFocus={(e) => { e.currentTarget.style.borderBottomColor = "var(--indigo)"; }}
        onBlur={(e) => { e.currentTarget.style.borderBottomColor = "var(--border-strong)"; }}
      />
      <div style={{ marginTop: 40 }}>
        <button type="submit" className="lm-btn lm-btn--accent lm-btn--lg" disabled={!canContinue}>
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

type SingleOption<T extends string> = { id: T; title: string; blurb?: string; emoji?: string };
function StepSingle<T extends string>({
  number, title, options, value, onPick,
}: {
  number: string;
  title: string;
  options: SingleOption<T>[];
  value: T | undefined;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <StepHeading number={number} eyebrow="one answer">{title}</StepHeading>
      <div className="flex flex-col" style={{ gap: 10, marginTop: 24 }}>
        {options.map((o) => (
          <OptionCard
            key={o.id}
            title={o.title}
            blurb={o.blurb}
            emoji={o.emoji}
            selected={value === o.id}
            onClick={() => onPick(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepMulti({
  number, value, onChange, onContinue,
}: {
  number: string;
  value: Interest[];
  onChange: (v: Interest[]) => void;
  onContinue: () => void;
}) {
  const toggle = (id: Interest) => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  };
  return (
    <div>
      <StepHeading number={number} eyebrow="pick any">What topics pull you in?</StepHeading>
      <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-3)" }}>
        Choose as many as you want.
      </p>

      <div
        className="grid grid-cols-2 sm:grid-cols-3"
        style={{ gap: 10, marginTop: 24 }}
      >
        {INTEREST_OPTIONS.map((o) => (
          <OptionCard
            key={o.id}
            title={o.title}
            emoji={o.emoji}
            selected={value.includes(o.id)}
            onClick={() => toggle(o.id)}
            multi
          />
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <button
          type="button"
          className="lm-btn lm-btn--accent lm-btn--lg"
          onClick={onContinue}
          disabled={value.length === 0}
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepDaily({
  number, value, onPick,
}: { number: string; value?: DailyGoalMinutes; onPick: (v: DailyGoalMinutes) => void }) {
  return (
    <div>
      <StepHeading number={number} eyebrow="protected time">Time you can protect each day?</StepHeading>
      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: 10, marginTop: 24 }}
      >
        {DAILY_GOAL_OPTIONS.map((o) => (
          <OptionCard
            key={o.id}
            title={o.title}
            selected={value === o.id}
            recommended={o.recommended}
            onClick={() => onPick(o.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StepGenerating({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (count >= GENERATING_LINES.length) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c + 1), 800);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <div>
      <StepHeading number="08" eyebrow="one moment">Composing your plan.</StepHeading>
      <ul
        className="flex flex-col"
        style={{ gap: 10, marginTop: 32, fontSize: 18, lineHeight: 1.4 }}
      >
        {GENERATING_LINES.slice(0, count).map((line, i) => (
          <motion.li
            key={line}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              color: i === count - 1 ? "var(--text)" : "var(--text-3)",
              fontWeight: i === count - 1 ? 500 : 400,
              listStyle: "none",
            }}
          >
            {line}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function StepReveal({
  answers, email, emailState, emailError, onEmailChange, onSubmit,
}: {
  answers: OnboardingAnswers;
  email: string;
  emailState: "idle" | "sending" | "sent" | "error";
  emailError: string | null;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const goalLine = answers.primaryGoal
    ? REVEAL_LINES_BY_GOAL[answers.primaryGoal]
    : REVEAL_LINES_BY_GOAL.curiosity;
  const streakGoal = 9;
  const firstCourseTitle = "ChatGPT Basics";
  const firstCourseSubtitle = "Your first real conversation";

  if (emailState === "sent") {
    return (
      <div>
        <p className="lm-eyebrow">
          <span className="lm-tabular" style={{ marginRight: 8 }}>09</span>
          check your inbox
        </p>
        <h1
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 36, lineHeight: 1.1, color: "var(--text)" }}
        >
          Magic link sent to{" "}
          <em
            style={{
              fontStyle: "italic",
              color: "var(--indigo)",
              wordBreak: "break-all",
            }}
          >
            {email}
          </em>
          .
        </h1>
        <p
          style={{ marginTop: 20, fontSize: 15, lineHeight: 1.65, color: "var(--text-2)" }}
        >
          Tap the link to finish setup. It opens this page, and we&apos;ll pick up right where we left off.
        </p>
        <p style={{ marginTop: 40, fontSize: 13, color: "var(--text-3)" }}>
          Didn&apos;t arrive? Check spam, or{" "}
          <button
            type="button"
            onClick={onSubmit}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--indigo)",
              cursor: "pointer",
              textDecoration: "underline",
              font: "inherit",
              padding: 0,
            }}
          >
            send again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <StepHeading number="09" eyebrow="your plan">Here&apos;s the rhythm we think will suit you.</StepHeading>

      <div className="lm-card" style={{ marginTop: 24, padding: 24 }}>
        <div className="flex items-center" style={{ gap: 16 }}>
          <NovaAvatarLg />
          <div>
            <p className="lm-eyebrow">your tutor</p>
            <p
              className="lm-serif"
              style={{ marginTop: 4, fontSize: 18, color: "var(--text)" }}
            >
              Nova — <em style={{ fontStyle: "italic", color: "var(--text-3)" }}>warm &amp; patient</em>
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-2"
          style={{ gap: 12, marginTop: 20 }}
        >
          <StatBlock label="daily" value={`${answers.dailyGoalMinutes ?? 10} min`} />
          <StatBlock label="streak goal" value={`${streakGoal} days`} />
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--border)",
          }}
        >
          <p className="lm-eyebrow">first course</p>
          <p
            className="lm-serif"
            style={{ marginTop: 6, fontSize: 18, color: "var(--text)" }}
          >
            {firstCourseTitle}
          </p>
          <p
            style={{ marginTop: 2, fontSize: 14, color: "var(--text-3)" }}
          >
            {firstCourseSubtitle}
          </p>
        </div>

        <p
          style={{
            marginTop: 20,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-2)",
          }}
        >
          {goalLine}
        </p>
      </div>

      <form style={{ marginTop: 32 }} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label className="lm-eyebrow">where should we send it</label>
        <div
          className="flex flex-col sm:flex-row"
          style={{ gap: 10, marginTop: 8 }}
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="lm-input"
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="lm-btn lm-btn--accent"
            disabled={emailState === "sending" || email.trim().length < 4}
          >
            {emailState === "sending" ? "Sending…" : "Send magic link"}
          </button>
        </div>
        {emailError ? (
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--coral-deep)" }}>
            {emailError}
          </p>
        ) : null}
        <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-3)" }}>
          We&apos;ll email you a single-use link. No password, no spam.
        </p>
      </form>

      <div style={{ marginTop: 24, fontSize: 12, color: "var(--text-3)" }}>
        Prefer Google?{" "}
        <Link
          href="/login"
          style={{ color: "var(--indigo)", textDecoration: "underline" }}
        >
          sign in there
        </Link>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "var(--bg-soft)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-3)",
        padding: "12px 14px",
      }}
    >
      <p className="lm-eyebrow">{label}</p>
      <p
        className="lm-serif lm-tabular"
        style={{ marginTop: 4, fontSize: 18, color: "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

function NovaAvatarLg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-avatars/nova.png`
    : null;
  return (
    <span
      className="lm-avatar"
      style={{ width: 56, height: 56, fontSize: 18 }}
      aria-label="Nova"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span aria-hidden>N</span>
      )}
    </span>
  );
}
