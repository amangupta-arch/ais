"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { LANGUAGE_OPTIONS } from "@/app/update-yaml/constants";

export type CatalogRow = {
  bundleSlug: string;
  bundleTitle: string;
  courseSlug: string;
  courseTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonIndex: number;
  courseLessonCount: number;
  enExists: boolean;
};

export type JobRow = {
  course_slug: string;
  lesson_slug: string;
  language: string;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  yaml_path: string | null;
  error: string | null;
  model: string | null;
};

type AudioSummary = {
  ok: boolean;
  total: number;
  hits: number;
  misses: number;
  failed: number;
  bytesFromTts: number;
  skipReason?: string;
};

type ApiResult = {
  ok: boolean;
  message?: string;
  attempts?: number;
  yamlPath?: string | null;
  diskNote?: string | null;
  stage?: string;
  lesson?: { slug: string; turn_count: number; language: string };
  audio?: AudioSummary | null;
};

type LogEvent =
  | { kind: "step"; at: string; message: string }
  | { kind: "audio:start"; total: number; voiceId: string; model: string }
  | { kind: "audio:skipped"; reason: string }
  | {
      kind: "audio:chunk";
      done: number;
      total: number;
      cacheHit: boolean;
      bytes: number;
      preview: string;
    }
  | {
      kind: "audio:chunk_failed";
      done: number;
      total: number;
      error: string;
      preview: string;
    }
  | {
      kind: "audio:done";
      total: number;
      hits: number;
      misses: number;
      failed: number;
      bytesFromTts: number;
    }
  | { kind: "result"; at?: string; [k: string]: unknown };

function jobKey(courseSlug: string, lessonSlug: string, language: string): string {
  return `${courseSlug}::${lessonSlug}::${language}`;
}

export default function GenerateForm({
  rows,
  initialJobs,
}: {
  rows: CatalogRow[];
  initialJobs: JobRow[];
}) {
  // Catalog → bundle/course/lesson trees.
  const bundles = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.bundleSlug, r.bundleTitle);
    return [...map.entries()].map(([slug, title]) => ({ slug, title }));
  }, [rows]);

  const [bundleSlug, setBundleSlug] = useState<string>(bundles[0]?.slug ?? "");
  const courses = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.bundleSlug === bundleSlug) map.set(r.courseSlug, r.courseTitle);
    }
    return [...map.entries()].map(([slug, title]) => ({ slug, title }));
  }, [rows, bundleSlug]);

  const [courseSlug, setCourseSlug] = useState<string>(courses[0]?.slug ?? "");
  useEffect(() => {
    if (!courses.find((c) => c.slug === courseSlug)) {
      setCourseSlug(courses[0]?.slug ?? "");
    }
  }, [courses, courseSlug]);

  const lessons = useMemo(
    () =>
      rows
        .filter((r) => r.courseSlug === courseSlug)
        .sort((a, b) => a.lessonIndex - b.lessonIndex),
    [rows, courseSlug],
  );

  const [lessonSlug, setLessonSlug] = useState<string>(lessons[0]?.lessonSlug ?? "");
  useEffect(() => {
    if (!lessons.find((l) => l.lessonSlug === lessonSlug)) {
      setLessonSlug(lessons[0]?.lessonSlug ?? "");
    }
  }, [lessons, lessonSlug]);

  const [language, setLanguage] = useState<string>("en");

  // Jobs map for quick lookup. Refreshed in-place when polling.
  const [jobsByKey, setJobsByKey] = useState<Map<string, JobRow>>(() => {
    const m = new Map<string, JobRow>();
    for (const j of initialJobs) m.set(jobKey(j.course_slug, j.lesson_slug, j.language), j);
    return m;
  });

  const selectedJob = jobsByKey.get(jobKey(courseSlug, lessonSlug, language)) ?? null;
  const selectedRow = lessons.find((l) => l.lessonSlug === lessonSlug) ?? null;
  // Translations require the EN canonical to exist as a base. Anything
  // that proves EN content is available counts: an on-disk file at
  // deploy time, or a prior generator job that completed.
  const enJob = jobsByKey.get(jobKey(courseSlug, lessonSlug, "en")) ?? null;
  const enReady = !!(selectedRow?.enExists || enJob?.status === "done");
  const blockedTranslation = language !== "en" && !enReady;

  // True when the selected (course, lesson, language) already has
  // generated content — on-disk YAML (EN only, known from server
  // props), a completed job row, or a stored yaml_path. We use this
  // to gate the Start click behind a confirm dialog so the user
  // doesn't accidentally re-spend Anthropic + ElevenLabs credits.
  const alreadyHasYaml =
    (language === "en" && !!selectedRow?.enExists) ||
    selectedJob?.status === "done" ||
    !!selectedJob?.yaml_path;

  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the log box to the bottom as new events arrive.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // Poll the jobs table while a generation is in flight so the UI keeps
  // updating even if the API request connection drops. Stops on
  // terminal status (done/failed). Also stops after MAX_POLLS so a
  // stranded "running" row can't burn the tab forever.
  useEffect(() => {
    if (!polling) return;
    const MAX_POLLS = 120; // 120 × 3s = 6 minutes
    let n = 0;
    const id = setInterval(async () => {
      n++;
      if (n > MAX_POLLS) {
        setPolling(false);
        return;
      }
      const res = await fetch("/api/yaml-jobs/list", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { jobs: JobRow[] };
      const m = new Map<string, JobRow>();
      for (const j of data.jobs) m.set(jobKey(j.course_slug, j.lesson_slug, j.language), j);
      setJobsByKey(m);
      const j = m.get(jobKey(courseSlug, lessonSlug, language));
      if (j && (j.status === "done" || j.status === "failed")) setPolling(false);
    }, 3000);
    return () => clearInterval(id);
  }, [polling, courseSlug, lessonSlug, language]);

  function handleStartClick() {
    if (!courseSlug || !lessonSlug || submitting || blockedTranslation) return;
    if (alreadyHasYaml) {
      setConfirmOpen(true);
      return;
    }
    void runGeneration();
  }

  async function runGeneration() {
    if (!courseSlug || !lessonSlug) return;
    setConfirmOpen(false);
    setSubmitting(true);
    setResult(null);
    setLog([]);
    setPolling(true);
    try {
      const res = await fetch("/api/yaml-jobs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseSlug, lessonSlug, language }),
      });

      // Pre-stream errors (auth, bad body) come back as plain JSON.
      // Also bail if the response isn't 2xx — an error path could in
      // theory still be NDJSON, but we'd rather surface the HTTP error
      // straightforwardly than parse half a stream.
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.startsWith("application/x-ndjson")) {
        const data = (await res.json().catch(() => ({}))) as ApiResult;
        setResult({
          ok: false,
          message: data.message ?? `HTTP ${res.status}`,
        });
        return;
      }

      // Streaming NDJSON — one event per line.
      const reader = res.body?.getReader();
      if (!reader) {
        setResult({ ok: false, message: "no response stream." });
        return;
      }
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: LogEvent;
          try {
            event = JSON.parse(line) as LogEvent;
          } catch {
            continue;
          }
          if (event.kind === "result") {
            setResult({
              ok: !!event.ok,
              message: event.message as string | undefined,
              attempts: event.attempts as number | undefined,
              yamlPath: event.yamlPath as string | null | undefined,
              diskNote: event.diskNote as string | null | undefined,
              stage: event.stage as string | undefined,
              lesson: event.lesson as ApiResult["lesson"],
              audio: event.audio as AudioSummary | null | undefined,
            });
            // Stream gave us the answer — no point polling further.
            // (We still leave polling alive across the fetch boundary
            // for the network-drop case where no result event arrives.)
            setPolling(false);
          } else {
            setLog((prev) => [...prev, event]);
          }
        }
      }
    } catch (e) {
      setResult({
        ok: false,
        message: `Request lost (${String(e)}) — still watching the job row in case it finishes server-side.`,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function formatLogLine(e: LogEvent): { tone: "step" | "audio" | "warn" | "ok" | "err"; text: string } {
    switch (e.kind) {
      case "step":
        return { tone: "step", text: `· ${e.message}` };
      case "audio:start":
        return {
          tone: "audio",
          text: `▶ audio: ${e.total} chunk${e.total === 1 ? "" : "s"} via ${e.model} (voice ${e.voiceId.slice(0, 8)}…)`,
        };
      case "audio:skipped":
        return { tone: "warn", text: `⚠ audio skipped: ${e.reason}` };
      case "audio:chunk":
        return {
          tone: "audio",
          text: `  ${e.done.toString().padStart(2, " ")}/${e.total} ${
            e.cacheHit ? "cache" : `synth ${(e.bytes / 1024).toFixed(0)}KB`
          } · "${e.preview}${e.preview.length === 60 ? "…" : ""}"`,
        };
      case "audio:chunk_failed":
        return {
          tone: "err",
          text: `  ${e.done}/${e.total} FAIL · "${e.preview}…" · ${e.error}`,
        };
      case "audio:done":
        return {
          tone: e.failed > 0 ? "warn" : "ok",
          text: `✓ audio done: ${e.hits} cache hit, ${e.misses} synth, ${e.failed} failed, ${(e.bytesFromTts / 1024).toFixed(0)}KB new`,
        };
      default:
        return { tone: "step", text: JSON.stringify(e) };
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Field label="Bundle">
        <Select
          value={bundleSlug}
          onChange={setBundleSlug}
          options={bundles.map((b) => ({ value: b.slug, label: `${b.title}  (${b.slug})` }))}
        />
      </Field>

      <Field label="Course">
        <Select
          value={courseSlug}
          onChange={setCourseSlug}
          options={courses.map((c) => ({ value: c.slug, label: `${c.title}  (${c.slug})` }))}
        />
      </Field>

      <Field label="Lesson">
        <Select
          value={lessonSlug}
          onChange={setLessonSlug}
          options={lessons.map((l) => {
            const enJob = jobsByKey.get(jobKey(l.courseSlug, l.lessonSlug, "en"));
            const tag = l.enExists
              ? " ✓ on disk"
              : enJob?.status === "done"
              ? " ✓ done"
              : enJob?.status === "running"
              ? " ⏳ running"
              : enJob?.status === "failed"
              ? " ✗ failed"
              : "";
            const nn = String(l.lessonIndex).padStart(2, "0");
            return { value: l.lessonSlug, label: `${nn}. ${l.lessonTitle}${tag}` };
          })}
        />
      </Field>

      <Field label="Language">
        <Select
          value={language}
          onChange={setLanguage}
          options={LANGUAGE_OPTIONS.map((l) => ({ value: l.code, label: l.label }))}
        />
      </Field>

      <StatusBlock row={selectedRow} job={selectedJob} language={language} />

      {blockedTranslation ? (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            background: "#FEF3C7",
            color: "#78350F",
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          Translations use the canonical English YAML as their base. Generate{" "}
          <strong>English</strong> for this lesson first, then come back for{" "}
          {language}.
        </div>
      ) : null}

      <button
        onClick={handleStartClick}
        disabled={submitting || !lessonSlug || blockedTranslation}
        style={{
          marginTop: 8,
          padding: "12px 18px",
          borderRadius: 10,
          border: 0,
          background:
            submitting || blockedTranslation ? "#94A3B8" : "#4F46BA",
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          cursor:
            submitting || blockedTranslation ? "not-allowed" : "pointer",
        }}
      >
        {submitting
          ? "Working… (≈45–120s)"
          : blockedTranslation
          ? "Generate English first"
          : alreadyHasYaml
          ? "Regenerate…"
          : "Start generation"}
      </button>

      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm regeneration"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmOpen(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              maxWidth: 460,
              width: "100%",
              padding: 24,
              boxShadow: "0 16px 48px rgba(15, 23, 42, 0.35)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
              Regenerate this lesson?
            </h2>
            <p
              style={{
                marginTop: 10,
                fontSize: 14,
                lineHeight: 1.55,
                color: "#334155",
              }}
            >
              <strong>{selectedRow?.lessonTitle}</strong>{" "}
              <span style={{ color: "#64748B" }}>({language})</span> already has a
              generated YAML. Re-running will overwrite the lesson&apos;s turns in
              the DB and re-spend Anthropic + ElevenLabs credits (cached audio
              chunks are reused).
            </p>
            <p
              style={{
                marginTop: 8,
                fontSize: 13,
                lineHeight: 1.5,
                color: "#475569",
              }}
            >
              {language === "en" && selectedRow?.enExists ? "Source-of-truth: on-disk YAML at supabase/content/." : null}
              {selectedJob?.yaml_path ? `Stored at: ${selectedJob.yaml_path}` : null}
              {!selectedJob?.yaml_path && selectedJob?.status === "done" ? "Stored in DB only (Vercel)." : null}
            </p>
            <div
              style={{
                marginTop: 20,
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  background: "#fff",
                  color: "#0F172A",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runGeneration()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: 0,
                  background: "#4F46BA",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Yes, regenerate
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Live log */}
      {(log.length > 0 || submitting) ? (
        <div
          ref={logRef}
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 8,
            background: "#0F172A",
            color: "#E2E8F0",
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: "ui-monospace, monospace",
            maxHeight: 280,
            overflowY: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {log.map((e, i) => {
            const { tone, text } = formatLogLine(e);
            const color =
              tone === "ok"    ? "#86EFAC" :
              tone === "warn"  ? "#FCD34D" :
              tone === "err"   ? "#FCA5A5" :
              tone === "audio" ? "#C4B5FD" :
              "#E2E8F0";
            return (
              <div key={i} style={{ color }}>
                {text}
              </div>
            );
          })}
          {submitting ? (
            <div style={{ color: "#94A3B8", marginTop: 4 }}>…</div>
          ) : null}
        </div>
      ) : null}

      {result ? (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 8,
            background: result.ok ? "#DCFCE7" : "#FEE2E2",
            color: result.ok ? "#14532D" : "#7F1D1D",
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {result.ok ? (
            <>
              {`✓ Generated in ${result.attempts ?? "?"} attempt(s)\n→ ${result.lesson?.turn_count ?? "?"} turns loaded into DB`}
              {result.yamlPath ? `\non disk: ${result.yamlPath}` : ""}
              {result.diskNote ? `\nnote: ${result.diskNote}` : ""}
              {result.audio
                ? result.audio.skipReason
                  ? `\naudio: skipped (${result.audio.skipReason})`
                  : `\naudio: ${result.audio.total} chunks · ${result.audio.hits} cache · ${result.audio.misses} synth · ${result.audio.failed} failed`
                : ""}
              {"\n\n"}
              <a
                href={`/api/yaml-jobs/text?course=${encodeURIComponent(courseSlug)}&lesson=${encodeURIComponent(lessonSlug)}&language=${encodeURIComponent(language)}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#4F46BA", fontWeight: 700 }}
              >
                view yaml →
              </a>
            </>
          ) : (
            `✗ ${result.stage ? `[${result.stage}] ` : ""}${result.message ?? "Unknown error"}`
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "#475569",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: "1px solid #CBD5E1",
        fontSize: 14,
        background: "#fff",
        color: "#0F172A",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatusBlock({
  row,
  job,
  language,
}: {
  row: CatalogRow | null;
  job: JobRow | null;
  language: string;
}) {
  if (!row) return null;
  const onDisk = language === "en" ? row.enExists : false; // we only know EN existence server-side
  return (
    <div
      style={{
        marginTop: 4,
        padding: 12,
        borderRadius: 8,
        background: "#F1F5F9",
        fontSize: 13,
        color: "#334155",
        lineHeight: 1.5,
        fontFamily: "ui-monospace, monospace",
      }}
    >
      <div>
        Selected: <strong>{row.courseTitle}</strong> ›{" "}
        <strong>
          {String(row.lessonIndex).padStart(2, "0")}. {row.lessonTitle}
        </strong>{" "}
        <span style={{ color: "#64748B" }}>({language})</span>
      </div>
      <div style={{ marginTop: 6 }}>
        Disk: {onDisk ? "✓ file exists" : "— no file"}
        {"  "}·{"  "}
        Job:{" "}
        {job
          ? `${job.status}${job.attempts ? ` (${job.attempts} attempt${job.attempts === 1 ? "" : "s"})` : ""}`
          : "— never run"}
      </div>
      {job?.error ? (
        <div style={{ marginTop: 6, color: "#991B1B", whiteSpace: "pre-wrap" }}>
          last error: {job.error}
        </div>
      ) : null}
      {job?.yaml_path ? (
        <div style={{ marginTop: 6, color: "#475569" }}>path: {job.yaml_path}</div>
      ) : null}
    </div>
  );
}
