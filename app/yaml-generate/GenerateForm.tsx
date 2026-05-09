"use client";

import { useEffect, useMemo, useState } from "react";

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

type ApiResult = {
  ok: boolean;
  message?: string;
  attempts?: number;
  yamlPath?: string | null;
  diskNote?: string | null;
  stage?: string;
  lesson?: { slug: string; turn_count: number; language: string };
};

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

  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

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

  async function onStart() {
    if (!courseSlug || !lessonSlug) return;
    setSubmitting(true);
    setResult(null);
    // Start polling BEFORE the fetch — and keep it running across the
    // fetch outcome. The poller stops itself once the row hits a
    // terminal state (done/failed). This way a network drop or Vercel
    // timeout doesn't strand the UI on stale status.
    setPolling(true);
    try {
      const res = await fetch("/api/yaml-jobs/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseSlug, lessonSlug, language }),
      });
      const data = (await res.json()) as ApiResult;
      setResult(data);
    } catch (e) {
      setResult({
        ok: false,
        message: `Request lost (${String(e)}) — still watching the job row in case it finishes server-side.`,
      });
    } finally {
      setSubmitting(false);
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

      <button
        onClick={onStart}
        disabled={submitting || !lessonSlug}
        style={{
          marginTop: 8,
          padding: "12px 18px",
          borderRadius: 10,
          border: 0,
          background: submitting ? "#94A3B8" : "#4F46BA",
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          cursor: submitting ? "not-allowed" : "pointer",
        }}
      >
        {submitting ? "Generating… (≈30–60s)" : "Start generation"}
      </button>

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
