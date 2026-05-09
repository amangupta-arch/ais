"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  getCourseStats,
  listCourses,
  submitLessonYaml,
  type BundleOption,
  type CourseOption,
  type CourseStats,
  type SubmitResult,
} from "./actions";
import { ALL_BUNDLES, LANGUAGE_OPTIONS, ORPHAN_BUNDLE } from "./constants";

type Props = {
  bundles: BundleOption[];
  initialCourses: CourseOption[]; // courses for ALL_BUNDLES on first paint
};

type BundleSelection = string; // bundle.id | ORPHAN_BUNDLE | ALL_BUNDLES

export function UpdateYamlForm({ bundles, initialCourses }: Props) {
  const [bundleSel, setBundleSel] = useState<BundleSelection>(ALL_BUNDLES);
  const [courses, setCourses] = useState<CourseOption[]>(initialCourses);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [courseId, setCourseId] = useState<string>(initialCourses[0]?.id ?? "");

  const [language, setLanguage] = useState<string>("en");

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
  const isTranslation = language !== "en";

  // Refetch courses when bundle changes. Guard against stale responses:
  // if the user flips the dropdown faster than the network resolves, an
  // older request must not overwrite a newer bundle's results.
  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    listCourses({ bundleId: bundleSel })
      .then((next) => {
        if (cancelled) return;
        setCourses(next);
        if (!next.find((c) => c.id === courseId)) {
          setCourseId(next[0]?.id ?? "");
        }
      })
      .catch((e) => {
        if (!cancelled) console.error(e);
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // courseId intentionally omitted — we only want to react to bundle changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleSel]);

  // Refetch stats when course changes. Same stale-response guard as above.
  useEffect(() => {
    if (!courseId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    getCourseStats(courseId)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const r = await submitLessonYaml({
        courseId,
        yamlText,
        language,
        slug: slugOverride.trim() || undefined,
        orderIndex: orderOverride.trim() ? Number(orderOverride) : undefined,
      });
      setResult(r);
      if (r.ok) {
        setYamlText("");
        setSlugOverride("");
        setOrderOverride("");
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
  // For translation mode the slug must match an existing canonical lesson.
  // Surface those slugs as suggestions in a datalist.
  const canonicalSlugs = stats?.lessons.map((l) => l.slug) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <label style={fieldLabel}>
            <span style={labelText}>Bundle</span>
            <select
              value={bundleSel}
              onChange={(e) => setBundleSel(e.target.value)}
              style={inputStyle}
            >
              <option value={ALL_BUNDLES}>All bundles ({bundles.length})</option>
              <option value={ORPHAN_BUNDLE}>— Orphan courses (no bundle) —</option>
              <optgroup label="Bundles">
                {bundles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.slug} {b.title ? `— ${b.title}` : ""} ({b.course_count})
                  </option>
                ))}
              </optgroup>
            </select>
            <span style={hintText}>
              Filters the course list below. Pick &ldquo;Orphan&rdquo; for courses
              like <code>canva-magic</code> that aren&apos;t in any bundle.
            </span>
          </label>

          <label style={fieldLabel}>
            <span style={labelText}>
              Course {coursesLoading ? "(loading…)" : `(${courses.length})`}
            </span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
              style={inputStyle}
            >
              {courses.length === 0 ? (
                <option value="">No courses in this bundle</option>
              ) : null}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug} {c.title ? `— ${c.title}` : ""} ({c.lesson_count} lessons)
                </option>
              ))}
            </select>
          </label>
        </div>

        <label style={fieldLabel}>
          <span style={labelText}>Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={inputStyle}
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          <span style={hintText}>
            {isTranslation ? (
              <>
                Translation mode. The slug must match an existing canonical lesson.
                The YAML&apos;s turns are folded into{" "}
                <code>lessons.translations.{language}</code> as a full alternative
                document. Turn count and structure can differ from English.
              </>
            ) : (
              <>
                English (canonical). Writes the lesson row + replaces lesson_turns.
                Other-language overlays on the same lesson are preserved.
              </>
            )}
          </span>
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
              Order index{statsLoading ? " (loading…)" : ""}
            </span>
            <input
              type="number"
              min={1}
              value={orderOverride}
              onChange={(e) => setOrderOverride(e.target.value)}
              placeholder={isTranslation ? "(set by canonical)" : String(nextOrderHint)}
              disabled={isTranslation}
              style={{ ...inputStyle, opacity: isTranslation ? 0.5 : 1 }}
            />
            <span style={hintText}>
              {isTranslation
                ? "Translations inherit the canonical lesson's order."
                : `Leave blank to use ${nextOrderHint}. Enter an existing slot to overwrite.`}
            </span>
          </label>

          <label style={fieldLabel}>
            <span style={labelText}>
              Lesson slug {isTranslation ? "(must match canonical)" : "(optional)"}
            </span>
            <input
              type="text"
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder={isTranslation ? "e.g. first-real-conversation" : "auto-generated from title"}
              required={isTranslation}
              pattern="[a-z0-9][a-z0-9\\-]*"
              list={isTranslation ? "canonical-slugs" : undefined}
              style={inputStyle}
            />
            {isTranslation ? (
              <datalist id="canonical-slugs">
                {canonicalSlugs.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            ) : null}
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
            {pending
              ? "Loading…"
              : isTranslation
                ? `Validate + fold ${language}`
                : "Validate + load"}
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
              {isTranslation
                ? " You must author English first before adding translations."
                : null}
            </p>
          ) : (
            <ol
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingLeft: 0,
                listStyle: "none",
              }}
            >
              {stats.lessons.map((l) => (
                <li
                  key={l.slug}
                  style={{
                    display: "flex",
                    gap: 12,
                    fontSize: 13,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ color: "#999", minWidth: 24, textAlign: "right" }}>
                    {l.order_index}.
                  </span>
                  <span style={{ minWidth: 240 }}>{l.slug}</span>
                  <span style={{ color: "#666", flex: 1 }}>{l.title ?? "(no title)"}</span>
                  <span style={{ color: "#888", fontSize: 11 }}>
                    {l.languages.join(", ") || "—"}
                  </span>
                  {!l.is_published ? (
                    <span style={{ color: "#dc2626" }}>(unpub)</span>
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
