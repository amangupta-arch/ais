"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { OptionCard } from "@/components/ui/OptionCard";
import { TutorAvatar } from "@/components/ui/TutorAvatar";
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
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
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
    <main className="mx-auto max-w-2xl px-6 pt-8 pb-24 min-h-[100dvh] flex flex-col">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-serif text-lg text-ink-900">AIS</Link>
        <div className="flex items-center gap-3">
          {canBack ? (
            <button onClick={back} className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-ink-900">
              <ArrowLeft className="h-4 w-4" /> back
            </button>
          ) : null}
          <div className="hidden sm:block text-xs text-ink-500 font-tabular">{progressPct}%</div>
        </div>
      </header>

      {stepIndex >= 1 && stepIndex <= 7 ? (
        <div className="mt-4 h-[2px] rounded-full bg-paper-200 overflow-hidden">
          <motion.div
            className="h-full bg-ember-500"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </div>
      ) : null}

      <div className="flex-1 flex flex-col justify-center py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
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
    </main>
  );
}

/* ------------------------------------------------------------------ Steps */

function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div>
      <Eyebrow number="00">Before we begin</Eyebrow>
      <Display as="h1" size="xl" className="mt-4">
        A few <em className="italic font-normal">questions</em>.
      </Display>
      <p className="mt-5 text-ink-600 max-w-md leading-relaxed">
        Seven of them, about 90 seconds. We'll show you a plan, and then — if it's right — you tell us where to send it.
      </p>
      <div className="mt-8">
        <Button onClick={onStart} size="lg">Start</Button>
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
    <form
      onSubmit={(e) => { e.preventDefault(); if (canContinue) onContinue(); }}
    >
      <Eyebrow number={number}>Your name</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">What should we call you?</Display>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="First name is fine"
        className="mt-8 w-full bg-transparent border-0 border-b border-ink-300 focus:border-ember-500 outline-none font-serif text-3xl pb-2 placeholder:text-ink-400 transition-colors"
      />
      <div className="mt-10">
        <Button type="submit" size="lg" disabled={!canContinue}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
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
      <Eyebrow number={number}>One answer</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">{title}</Display>
      <div className="mt-8 flex flex-col gap-3">
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
      <Eyebrow number={number}>Pick any</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">What topics pull you in?</Display>
      <p className="mt-2 text-ink-500 text-sm">Choose as many as you want.</p>

      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
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

      <div className="mt-10">
        <Button size="lg" onClick={onContinue} disabled={value.length === 0}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepDaily({
  number, value, onPick,
}: { number: string; value?: DailyGoalMinutes; onPick: (v: DailyGoalMinutes) => void }) {
  return (
    <div>
      <Eyebrow number={number}>Protected time</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">Time you can protect each day?</Display>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCount((c) => c + 1), 900);
    return () => clearTimeout(t);
  }, [count, onDone]);

  return (
    <div>
      <Eyebrow number="08">One moment</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">
        <em className="italic font-normal">Composing</em> your plan.
      </Display>
      <ul className="mt-10 space-y-3 font-serif text-ink-700 text-xl leading-snug">
        {GENERATING_LINES.slice(0, count).map((line, i) => (
          <motion.li
            key={line}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className={i === count - 1 ? "text-ink-900" : "text-ink-500"}
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
  const goalLine = answers.primaryGoal ? REVEAL_LINES_BY_GOAL[answers.primaryGoal] : REVEAL_LINES_BY_GOAL.curiosity;
  const streakGoal = answers.dailyGoalMinutes ? 9 : 9;
  const firstCourseTitle = "ChatGPT Basics";
  const firstCourseSubtitle = "Your first real conversation";

  if (emailState === "sent") {
    return (
      <div>
        <Eyebrow number="09">Check your inbox</Eyebrow>
        <Display as="h1" size="lg" className="mt-3">
          Magic link sent to <em className="italic font-normal">{email}</em>.
        </Display>
        <p className="mt-5 text-ink-600 leading-relaxed">
          Tap the link to finish setup. It opens this page, and we'll pick up right where we left off.
        </p>
        <p className="mt-10 text-sm text-ink-500">
          Didn't arrive? Check spam, or <button className="underline hover:text-ink-800" onClick={onSubmit}>send again</button>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Eyebrow number="09">Your plan</Eyebrow>
      <Display as="h1" size="lg" className="mt-3">
        Here's the <em className="italic font-normal">rhythm</em> we think will suit you.
      </Display>

      <div className="mt-8 rounded-3xl bg-paper-100 border border-paper-200 p-6 sm:p-8 shadow-paper">
        <div className="flex items-center gap-4">
          <TutorAvatar personaId="nova" size="lg" />
          <div>
            <p className="eyebrow">your tutor</p>
            <p className="font-serif text-xl text-ink-900 mt-1">
              Nova — <em className="italic font-normal">warm &amp; patient</em>
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <StatBlock label="Daily" value={`${answers.dailyGoalMinutes ?? 10} min`} />
          <StatBlock label="Streak goal" value={`${streakGoal} days`} />
        </div>

        <div className="mt-6 pt-6 border-t border-paper-200">
          <p className="eyebrow">first course</p>
          <p className="mt-2 font-serif text-xl text-ink-900">{firstCourseTitle}</p>
          <p className="mt-1 text-ink-500 italic font-serif">{firstCourseSubtitle}</p>
        </div>

        <p className="mt-6 text-ink-600 leading-relaxed">{goalLine}</p>
      </div>

      <form
        className="mt-10"
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      >
        <label className="eyebrow">where should we send it</label>
        <div className="mt-3 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="flex-1 rounded-full px-5 h-12 bg-paper-100 border border-paper-200 outline-none focus:border-ember-500 transition-colors"
          />
          <Button type="submit" size="md" disabled={emailState === "sending" || email.trim().length < 4}>
            {emailState === "sending" ? "Sending…" : "Send magic link"}
          </Button>
        </div>
        {emailError ? <p className="mt-3 text-sm text-ember-700">{emailError}</p> : null}
        <p className="mt-4 text-xs text-ink-500">
          We'll email you a single-use link. No password, no spam.
        </p>
      </form>

      <div className="mt-8 text-xs text-ink-500">
        Prefer Google? <ButtonLink href="/login" variant="ghost" size="sm" className="!h-auto !px-0 underline">sign in there</ButtonLink>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper-50 border border-paper-200 px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-serif text-lg text-ink-900 font-tabular">{value}</p>
    </div>
  );
}
