"use client";

// Self-contained math-quiz player. Holds: state machine
// (question → analyzing → feedback → done), an elapsed-time timer,
// per-question handwriting snap + Claude grading, and a final summary.
//
// The page is public — no auth — and posts the (in-memory) photo to
// /api/ai/math-quiz, which forwards to Claude Sonnet vision and never
// persists the image.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Check, ImagePlus, RefreshCw, X } from "lucide-react";

import { LANGUAGES, type PreferredLanguage } from "@/lib/types";

import type { QuizQuestion } from "./questions";

type GraderResult = {
  isCorrect: boolean;
  detectedAnswer: number | null;
  feedback: string;
  mistakes: string[];
};

type AnsweredQuestion = QuizQuestion & {
  result: GraderResult;
  elapsedMs: number;
  imageDataUrl: string;
};

type Phase = "question" | "analyzing" | "feedback" | "done";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${pad2(m)}:${pad2(s)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Could not read image."));
    r.readAsDataURL(file);
  });
}

export default function MathQuizClient({ questions }: { questions: QuizQuestion[] }) {
  const [language, setLanguage] = useState<PreferredLanguage>("en");
  const [phase, setPhase] = useState<Phase>("question");
  const [currentIndex, setCurrentIndex] = useState(0);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<GraderResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quizStartedAtRef = useRef<number>(Date.now());
  const questionStartedAtRef = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [history, setHistory] = useState<AnsweredQuestion[]>([]);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const total = questions.length;
  const current = questions[currentIndex];

  // Tick the elapsed-time clock once per second while the quiz is running.
  useEffect(() => {
    if (phase === "done") return;
    const id = setInterval(() => {
      setElapsedMs(Date.now() - quizStartedAtRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const langLabel = useMemo(
    () => LANGUAGES.find((l) => l.code === language)?.english ?? "English",
    [language],
  );

  async function handleFileSelected(file: File | null | undefined) {
    if (!file) return;
    setErrorMsg(null);
    try {
      const url = await readFileAsDataUrl(file);
      setImageDataUrl(url);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not read image.");
    }
  }

  async function submitForGrading() {
    if (!current || !imageDataUrl) return;
    setPhase("analyzing");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/ai/math-quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: current.id,
          equation: current.display,
          expectedAnswer: current.expectedAnswer,
          language,
          image: imageDataUrl,
        }),
      });
      const data: GraderResult & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `Grader returned ${res.status}.`);
      }
      setResult({
        isCorrect: Boolean(data.isCorrect),
        detectedAnswer:
          typeof data.detectedAnswer === "number" ? data.detectedAnswer : null,
        feedback: data.feedback ?? "",
        mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
      });
      setPhase("feedback");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not analyse the image.");
      setPhase("question");
    }
  }

  function goNext() {
    if (!current || !result || !imageDataUrl) return;
    const elapsed = Date.now() - questionStartedAtRef.current;
    const nextHistory: AnsweredQuestion[] = [
      ...history,
      { ...current, result, elapsedMs: elapsed, imageDataUrl },
    ];
    setHistory(nextHistory);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= total) {
      setPhase("done");
      return;
    }
    setCurrentIndex(nextIndex);
    setImageDataUrl(null);
    setResult(null);
    setErrorMsg(null);
    setPhase("question");
    questionStartedAtRef.current = Date.now();
  }

  function restart() {
    setLanguage(language);
    setPhase("question");
    setCurrentIndex(0);
    setImageDataUrl(null);
    setResult(null);
    setErrorMsg(null);
    setHistory([]);
    quizStartedAtRef.current = Date.now();
    questionStartedAtRef.current = Date.now();
    setElapsedMs(0);
  }

  if (phase === "done") {
    return <SummaryScreen history={history} totalMs={elapsedMs} language={language} onRestart={restart} />;
  }
  if (!current) return null;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "20px 20px 48px" }}>
      <TopBar language={language} onLanguageChange={setLanguage} />

      <SegmentProgress current={currentIndex} total={total} />

      <QuestionCard index={currentIndex} display={current.display} />

      <div className="lm-eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>
        Your working
      </div>

      <SnapCard
        imageDataUrl={imageDataUrl}
        onClickCamera={() => cameraInputRef.current?.click()}
        onClickUpload={() => uploadInputRef.current?.click()}
        onClear={() => {
          setImageDataUrl(null);
          setResult(null);
          setErrorMsg(null);
        }}
      />

      {/* Hidden inputs — one prompts the camera on mobile, the other is a plain file picker. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {errorMsg && <ErrorBanner message={errorMsg} />}

      {phase === "feedback" && result && (
        <FeedbackBlock
          result={result}
          isLast={currentIndex === total - 1}
          onNext={goNext}
        />
      )}

      {phase !== "feedback" && (
        <button
          type="button"
          className="lm-btn lm-btn--accent lm-btn--full lm-btn--lg"
          style={{ marginTop: 20 }}
          disabled={!imageDataUrl || phase === "analyzing"}
          onClick={submitForGrading}
        >
          {phase === "analyzing" ? (
            <span>Maya is reading your work…</span>
          ) : (
            <>
              <Check size={18} aria-hidden /> Check my answer
            </>
          )}
        </button>
      )}

      <Footer langLabel={langLabel} elapsedMs={elapsedMs} />
    </div>
  );
}

// ─── pieces ──────────────────────────────────────────────────────────

function TopBar({
  language,
  onLanguageChange,
}: {
  language: PreferredLanguage;
  onLanguageChange: (l: PreferredLanguage) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <Link
        href="/"
        aria-label="Back"
        className="lm-btn lm-btn--icon"
        style={{ flexShrink: 0 }}
      >
        <ArrowLeft size={18} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="lm-eyebrow" style={{ fontSize: 10 }}>
          Math › Algebra › Linear eq.
        </div>
        <h1 className="lm-serif" style={{ fontSize: 22, lineHeight: 1.2, margin: 0, fontWeight: 500 }}>
          Quiz · solve on paper
        </h1>
      </div>
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value as PreferredLanguage)}
        className="lm-btn lm-btn--secondary lm-btn--sm"
        style={{
          padding: "8px 12px",
          appearance: "none",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--r-2)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          color: "var(--text)",
        }}
        aria-label="Feedback language"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}

function SegmentProgress({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i <= current;
          return (
            <div
              key={i}
              style={{
                height: 4,
                borderRadius: 2,
                background: filled ? "var(--indigo)" : "var(--bg-soft)",
                border: filled ? "none" : "1px solid var(--border-soft)",
              }}
            />
          );
        })}
      </div>
      <span className="lm-mono lm-tabular" style={{ fontSize: 11, color: "var(--text-3)" }}>
        {pad2(current + 1)}/{pad2(total)}
      </span>
    </div>
  );
}

function QuestionCard({ index, display }: { index: number; display: string }) {
  return (
    <div className="lm-card lm-card--raised" style={{ padding: 28 }}>
      <div className="lm-eyebrow">Question {pad2(index + 1)} · Solve for x</div>
      <div
        className="lm-serif"
        style={{
          fontStyle: "italic",
          fontSize: 56,
          textAlign: "center",
          margin: "20px 0 18px",
          color: "var(--ink)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {display}
      </div>
      <div
        style={{
          borderTop: "1px dashed var(--border-soft)",
          paddingTop: 12,
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-3)",
        }}
      >
        ✏️ Solve on paper · 📸 Snap when done
      </div>
    </div>
  );
}

function SnapCard({
  imageDataUrl,
  onClickCamera,
  onClickUpload,
  onClear,
}: {
  imageDataUrl: string | null;
  onClickCamera: () => void;
  onClickUpload: () => void;
  onClear: () => void;
}) {
  if (imageDataUrl) {
    return (
      <div className="lm-card" style={{ padding: 16, position: "relative" }}>
        <button
          type="button"
          aria-label="Remove photo"
          onClick={onClear}
          className="lm-btn lm-btn--icon"
          style={{ position: "absolute", top: 8, right: 8, background: "var(--surface)" }}
        >
          <X size={16} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageDataUrl}
          alt="Your handwritten working"
          style={{
            width: "100%",
            maxHeight: 360,
            objectFit: "contain",
            borderRadius: "var(--r-3)",
            background: "var(--bg-soft)",
          }}
        />
      </div>
    );
  }

  return (
    <div className="lm-card" style={{ padding: 28, textAlign: "center" }}>
      <div
        className="lm-avatar"
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 16px",
          background: "var(--indigo-soft)",
          color: "var(--indigo-deep)",
        }}
      >
        <Camera size={28} />
      </div>
      <div className="lm-serif" style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>
        Snap your paper
      </div>
      <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 auto 16px", maxWidth: 320, lineHeight: 1.4 }}>
        Make sure the page is in focus and your steps are visible. Maya will read your handwriting.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="lm-btn lm-btn--secondary" onClick={onClickCamera}>
          <Camera size={16} /> Camera
        </button>
        <button type="button" className="lm-btn lm-btn--secondary" onClick={onClickUpload}>
          <ImagePlus size={16} /> Upload
        </button>
      </div>
    </div>
  );
}

function FeedbackBlock({
  result,
  isLast,
  onNext,
}: {
  result: GraderResult;
  isLast: boolean;
  onNext: () => void;
}) {
  const tone = result.isCorrect
    ? { bg: "var(--moss-soft)", border: "var(--moss)", label: "Correct", color: "var(--moss-deep)" }
    : { bg: "var(--coral-soft)", border: "var(--coral)", label: "Not quite", color: "var(--coral-deep)" };

  return (
    <div
      className="lm-card"
      style={{
        marginTop: 16,
        background: tone.bg,
        borderColor: tone.border,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 700,
          color: tone.color,
          marginBottom: 6,
        }}
      >
        {result.isCorrect ? <Check size={16} /> : <X size={16} />} {tone.label}
        {result.detectedAnswer !== null && (
          <span
            className="lm-mono lm-tabular"
            style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}
          >
            you wrote x = {result.detectedAnswer}
          </span>
        )}
      </div>
      {result.feedback && (
        <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
          {result.feedback}
        </p>
      )}
      {result.mistakes.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
          {result.mistakes.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="lm-btn lm-btn--accent lm-btn--full lm-btn--lg"
        style={{ marginTop: 16 }}
        onClick={onNext}
      >
        {isLast ? "See my results" : "Next question"}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="lm-card"
      style={{
        marginTop: 16,
        background: "var(--coral-soft)",
        borderColor: "var(--coral)",
        color: "var(--coral-deep)",
        fontSize: 13,
        padding: 14,
      }}
    >
      {message}
    </div>
  );
}

function Footer({ langLabel, elapsedMs }: { langLabel: string; elapsedMs: number }) {
  return (
    <div
      style={{
        marginTop: 28,
        paddingTop: 16,
        borderTop: "1px solid var(--border-soft)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 11,
        color: "var(--text-3)",
      }}
    >
      <span>
        feedback in <span className="lm-mono">{langLabel}</span> · powered by Maya
      </span>
      <span className="lm-mono lm-tabular">{fmtClock(elapsedMs)}</span>
    </div>
  );
}

// ─── final summary ─────────────────────────────────────────────────────

function SummaryScreen({
  history,
  totalMs,
  language,
  onRestart,
}: {
  history: AnsweredQuestion[];
  totalMs: number;
  language: PreferredLanguage;
  onRestart: () => void;
}) {
  const total = history.length;
  const correct = history.filter((h) => h.result.isCorrect).length;
  const avgMs = total > 0 ? Math.round(history.reduce((s, h) => s + h.elapsedMs, 0) / total) : 0;
  const fastest = history.reduce<AnsweredQuestion | null>(
    (best, h) => (best === null || h.elapsedMs < best.elapsedMs ? h : best),
    null,
  );
  const slowest = history.reduce<AnsweredQuestion | null>(
    (worst, h) => (worst === null || h.elapsedMs > worst.elapsedMs ? h : worst),
    null,
  );
  const langLabel = LANGUAGES.find((l) => l.code === language)?.english ?? "English";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Link href="/" aria-label="Home" className="lm-btn lm-btn--icon">
          <ArrowLeft size={18} />
        </Link>
        <div className="lm-eyebrow">Quiz complete</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="lm-card lm-card--raised" style={{ padding: 28, textAlign: "center" }}>
        <div className="lm-eyebrow" style={{ marginBottom: 8 }}>
          Score
        </div>
        <div className="lm-serif" style={{ fontSize: 56, fontWeight: 500, lineHeight: 1, marginBottom: 4 }}>
          {correct}<span style={{ color: "var(--text-3)", fontSize: 28 }}> / {total}</span>
        </div>
        <div style={{ fontSize: 14, color: "var(--text-2)" }}>
          {correct === total
            ? "Spotless. You ran the table."
            : correct === 0
            ? "Tough round. Worth another go."
            : `${Math.round((correct / total) * 100)}% correct.`}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12 }}>
        <Stat label="Total time" value={fmtClock(totalMs)} />
        <Stat label="Avg / question" value={fmtClock(avgMs)} />
        <Stat
          label="Fastest"
          value={fastest ? fmtClock(fastest.elapsedMs) : "—"}
          sub={fastest ? `Q${fastest.id}` : undefined}
        />
      </div>

      <div className="lm-eyebrow" style={{ marginTop: 24, marginBottom: 8 }}>
        Question by question
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {history.map((h) => (
          <div
            key={h.id}
            className="lm-card"
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
              borderColor: h.result.isCorrect ? "var(--moss)" : "var(--coral)",
            }}
          >
            <div
              className="lm-mono lm-tabular"
              style={{
                width: 28,
                fontSize: 12,
                color: "var(--text-3)",
              }}
            >
              {pad2(h.id)}
            </div>
            <div className="lm-serif" style={{ fontStyle: "italic", fontSize: 18, flex: 1 }}>
              {h.display}
            </div>
            <div
              className="lm-mono lm-tabular"
              style={{ fontSize: 12, color: "var(--text-3)" }}
            >
              {fmtClock(h.elapsedMs)}
            </div>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                background: h.result.isCorrect ? "var(--moss-soft)" : "var(--coral-soft)",
                color: h.result.isCorrect ? "var(--moss-deep)" : "var(--coral-deep)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {h.result.isCorrect ? <Check size={14} /> : <X size={14} />}
            </div>
          </div>
        ))}
      </div>

      {slowest && slowest.elapsedMs > 0 && total >= 3 && (
        <div
          className="lm-card"
          style={{
            marginTop: 16,
            padding: 14,
            background: "var(--bg-soft)",
            fontSize: 13,
            color: "var(--text-2)",
            lineHeight: 1.5,
          }}
        >
          <div className="lm-eyebrow" style={{ marginBottom: 4 }}>
            Notes
          </div>
          You spent the most time on <strong>Q{slowest.id} · {slowest.display}</strong> ({fmtClock(slowest.elapsedMs)}).
          {fastest && fastest.id !== slowest.id && (
            <>
              {" "}You moved fastest on <strong>Q{fastest.id}</strong> ({fmtClock(fastest.elapsedMs)}).
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="lm-btn lm-btn--accent lm-btn--full lm-btn--lg"
        style={{ marginTop: 20 }}
        onClick={onRestart}
      >
        <RefreshCw size={16} /> Try again
      </button>

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid var(--border-soft)",
          fontSize: 11,
          color: "var(--text-3)",
          textAlign: "center",
        }}
      >
        feedback in <span className="lm-mono">{langLabel}</span> · powered by Maya
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="lm-card" style={{ padding: 14, textAlign: "center" }}>
      <div className="lm-eyebrow" style={{ fontSize: 10, marginBottom: 4 }}>
        {label}
      </div>
      <div className="lm-mono lm-tabular" style={{ fontSize: 18, fontWeight: 600 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
