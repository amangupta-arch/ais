"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  getCourseStats,
  submitLessonYaml,
  type CourseOption,
  type CourseStats,
  type SubmitResult,
} from "./actions";

type Props = {
  courses: CourseOption[];
};

export function UpdateYamlForm({ courses }: Props) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [stats, setStats] = useState<CourseStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [yamlText, setYamlText] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [orderOverride, setOrderOverride] = useState<string>("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, start] = useTransition();

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );

  useEffect(() => {
    if (!courseId) {
      setStats(null);
      return;
    }
    setStatsLoading(true);
    getCourseStats(courseId)
      .then(setStats)
      .catch((e) => {
        console.error(e);
        setStats(null);
      })
      .finally(() => setStatsLoading(false));
  }, [courseId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const r = await submitLessonYaml({
        courseId,
        yamlText,
        slug: slugOverride.trim() || undefined,
        orderIndex: orderOverride.trim() ? Number(orderOverride) : undefined,
      });
      setResult(r);
      if (r.ok) {
        // Reset paste box for the next lesson, but keep course selection.
        setYamlText("");
        setSlugOverride("");
        setOrderOverride("");
        // Refresh stats so "next" advances to the new index.
        try {
          const next = await getCourseStats(courseId);
          setStats(next);
        } catch {
          // ignore
        }
      }
    });
  };

  const nextOrderHint = stats?.nextOrderIndex ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={fieldLabel}>
          <span style={labelText}>Course</span>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
            style={inputStyle}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.slug} {c.title ? `— ${c.title}` : ""} ({c.lesson_count} lessons)
              </option>
            ))}
          </select>
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <label style={fieldLabel}>
            <span style={labelText}>
              Next order index
              {statsLoading ? " (loading…)" : null}
            </span>
            <input
              type="number"
              min={1}
              value={orderOverride}
              onChange={(e) => setOrderOverride(e.target.value)}
              placeholder={String(nextOrderHint)}
              style={inputStyle}
            />
            <span style={hintText}>
              Leave blank to use {nextOrderHint}. Submit a slug that already
              exists to overwrite it in place.
            </span>
          </label>

          <label style={fieldLabel}>
            <span style={labelText}>Lesson slug (optional)</span>
            <input
              type="text"
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder="auto-generated from title"
              pattern="[a-z0-9][a-z0-9\\-]*"
              style={inputStyle}
            />
            <span style={hintText}>
              Lowercase, hyphens. URL becomes{" "}
              <code>
                /learn/{selectedCourse?.slug ?? "<course>"}/&lt;slug&gt;
              </code>
              .
            </span>
          </label>
        </div>

        <label style={fieldLabel}>
          <span style={labelText}>Lesson YAML</span>
          <textarea
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            rows={22}
            required
            placeholder={`title: "Magic Design Tour"
subtitle: "What it does in 60 seconds"
estimated_minutes: 5
xp_reward: 20
turns:
  - type: tutor_message
    text: "Welcome…"
    typing_ms: 800
  - type: mcq
    question: "Which input does Magic Design need?"
    options:
      - { id: a, text: "Just a prompt", is_correct: true }
      - { id: b, text: "A finished layout", is_correct: false }
    xp: 5
  - type: checkpoint
    title: "You met Magic Design."
    summary: "…"`}
            style={{
              ...inputStyle,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              fontSize: 13,
              minHeight: 320,
              whiteSpace: "pre",
              tabSize: 2,
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="submit"
            disabled={pending || !courseId || yamlText.trim().length === 0}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: pending ? "#888" : "#000",
              color: "#fff",
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              border: "none",
            }}
          >
            {pending ? "Loading…" : "Validate + load"}
          </button>
        </div>
      </form>

      {result ? (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            border: "1px solid",
            borderColor: result.ok ? "#22c55e" : "#dc2626",
            background: result.ok ? "#f0fdf4" : "#fef2f2",
            color: result.ok ? "#166534" : "#7f1d1d",
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            fontSize: 13,
          }}
        >
          {result.message}
        </div>
      ) : null}

      {stats ? (
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Existing lessons in {selectedCourse?.slug}
          </h2>
          {stats.lessons.length === 0 ? (
            <p style={{ fontSize: 13, color: "#666" }}>
              No lessons yet. The first paste will be order 1.
            </p>
          ) : (
            <ol style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 0, listStyle: "none" }}>
              {stats.lessons.map((l) => (
                <li
                  key={l.slug}
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 13,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                  }}
                >
                  <span style={{ color: "#999", minWidth: 24, textAlign: "right" }}>
                    {l.order_index}.
                  </span>
                  <span style={{ minWidth: 240 }}>{l.slug}</span>
                  <span style={{ color: "#666" }}>{l.title ?? "(no title)"}</span>
                  {!l.is_published ? (
                    <span style={{ color: "#dc2626" }}>(unpublished)</span>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const labelText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#444",
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 14,
  borderRadius: 6,
  border: "1px solid #d4d4d4",
  background: "#fff",
};
const hintText: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
};
