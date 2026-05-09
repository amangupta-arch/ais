/** /yaml-status — read-only board showing how many lesson YAMLs have
 *  been generated vs. how many are still pending across the whole
 *  catalog. Public (matches /database-schema). Auto-refreshes every 8s
 *  via meta http-equiv refresh.
 *
 *  Each row carries:
 *   - the EN status badge (primary)
 *   - a small per-language strip below for non-EN languages, each
 *     clickable to view the generated YAML if available
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { LANGUAGE_OPTIONS } from "@/app/update-yaml/constants";
import {
  enumerateAllLessons,
  lessonYamlExists,
  type LessonEntry,
} from "@/lib/yaml-generation/catalog";

export const dynamic = "force-dynamic";

type JobRow = {
  course_slug: string;
  lesson_slug: string;
  language: string;
  status: "queued" | "running" | "done" | "failed";
  attempts: number;
  started_at: string | null;
  finished_at: string | null;
  yaml_path: string | null;
  yaml_text: string | null;
  error: string | null;
  model: string | null;
  updated_at: string | null;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

function jobKey(c: string, l: string, lang: string): string {
  return `${c}::${l}::${lang}`;
}

async function loadJobsByKey(): Promise<Map<string, JobRow>> {
  const admin = adminClient();
  if (!admin) return new Map();
  const { data } = await admin
    .from("yaml_generation_jobs")
    .select(
      "course_slug, lesson_slug, language, status, attempts, started_at, finished_at, yaml_path, yaml_text, error, model, updated_at",
    );
  const map = new Map<string, JobRow>();
  for (const j of (data ?? []) as JobRow[]) {
    map.set(jobKey(j.course_slug, j.lesson_slug, j.language), j);
  }
  return map;
}

/** Returns map: `${courseSlug}::${lessonSlug}::${language}` → chunk count
 *  in lesson_audio_manifest. Used to render the audio coverage chip per
 *  language on each row. Three small queries; manageable for now. */
async function loadAudioCoverage(): Promise<Map<string, number>> {
  const admin = adminClient();
  if (!admin) return new Map();
  const { data: rows } = await admin
    .from("lesson_audio_manifest")
    .select("lesson_id, language");
  if (!rows?.length) return new Map();

  const lessonIds = [...new Set(rows.map((r) => r.lesson_id as string))];
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, slug, course_id")
    .in("id", lessonIds);

  const courseIds = [
    ...new Set((lessons ?? []).map((l) => l.course_id as string)),
  ];
  const { data: courses } = await admin
    .from("courses")
    .select("id, slug")
    .in("id", courseIds);

  type LessonRow = { id: string; slug: string; course_id: string };
  type CourseRow = { id: string; slug: string };
  const lessonById = new Map<string, LessonRow>(
    (lessons ?? []).map((l) => [l.id as string, l as unknown as LessonRow]),
  );
  const courseSlugById = new Map<string, string>(
    (courses ?? []).map((c) => [c.id as string, c.slug as string]),
  );

  const out = new Map<string, number>();
  for (const r of rows) {
    const lesson = lessonById.get(r.lesson_id as string);
    if (!lesson) continue;
    const courseSlug = courseSlugById.get(lesson.course_id);
    if (!courseSlug) continue;
    const k = jobKey(courseSlug, lesson.slug, r.language as string);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

type Status = "done" | "running" | "failed" | "pending";

/** Status of one lesson in one language. Considers on-disk YAML AND
 *  job-row state; either being terminal-good counts as done. */
function statusOfLang(
  entry: LessonEntry,
  language: string,
  jobs: Map<string, JobRow>,
): Status {
  if (lessonYamlExists(entry, language)) return "done";
  const job = jobs.get(jobKey(entry.courseSlug, entry.lessonSlug, language));
  if (!job) return "pending";
  if (job.status === "done") return "done";
  if (job.status === "running" || job.status === "queued") return "running";
  if (job.status === "failed") return "failed";
  return "pending";
}

const STATUS_STYLE: Record<Status, { bg: string; fg: string; label: string }> = {
  done:    { bg: "#DCFCE7", fg: "#166534", label: "DONE" },
  running: { bg: "#DBEAFE", fg: "#1E40AF", label: "RUNNING" },
  failed:  { bg: "#FEE2E2", fg: "#991B1B", label: "FAILED" },
  pending: { bg: "#F1F5F9", fg: "#475569", label: "PENDING" },
};

const LANG_STYLE: Record<Status, { bg: string; fg: string; mark: string }> = {
  done:    { bg: "#DCFCE7", fg: "#166534", mark: "✓" },
  running: { bg: "#DBEAFE", fg: "#1E40AF", mark: "⏳" },
  failed:  { bg: "#FEE2E2", fg: "#991B1B", mark: "✗" },
  pending: { bg: "#F8FAFC", fg: "#94A3B8", mark: "·" },
};

const NON_EN_LANGS = LANGUAGE_OPTIONS.filter((l) => l.code !== "en");

function textHref(courseSlug: string, lessonSlug: string, language: string): string {
  const q = new URLSearchParams({ course: courseSlug, lesson: lessonSlug, language });
  return `/api/yaml-jobs/text?${q.toString()}`;
}

export default async function YamlStatusPage() {
  const entries = enumerateAllLessons();
  const [jobs, audioCoverage] = await Promise.all([
    loadJobsByKey(),
    loadAudioCoverage(),
  ]);

  const byCourse = new Map<string, LessonEntry[]>();
  for (const e of entries) {
    const arr = byCourse.get(e.courseSlug) ?? [];
    arr.push(e);
    byCourse.set(e.courseSlug, arr);
  }

  // Tiles still EN-track (the primary content axis). Translations roll
  // up in a smaller summary line under the tiles.
  const enCounts: Record<Status, number> = { done: 0, running: 0, failed: 0, pending: 0 };
  for (const e of entries) enCounts[statusOfLang(e, "en", jobs)]++;
  const total = entries.length;

  // Translations summary across all non-EN languages: "done" total +
  // "started" total (anything not pending).
  let trDone = 0;
  let trStarted = 0;
  const trUniverse = entries.length * NON_EN_LANGS.length;
  for (const e of entries) {
    for (const l of NON_EN_LANGS) {
      const s = statusOfLang(e, l.code, jobs);
      if (s !== "pending") trStarted++;
      if (s === "done") trDone++;
    }
  }

  return (
    <main style={{ minHeight: "100dvh", background: "#FAFAFA", padding: "32px 16px 80px" }}>
      <meta httpEquiv="refresh" content="8" />

      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <header style={{ marginBottom: 16 }}>
          <a
            href="/yaml-generate"
            style={{
              fontSize: 12,
              color: "#475569",
              textDecoration: "none",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            yaml generator →
          </a>
          <h1 style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: "#0F172A" }}>
            YAML generation status
          </h1>
          <p style={{ marginTop: 6, fontSize: 14, color: "#475569", lineHeight: 1.5 }}>
            EN tiles are the canonical track. Each row also shows a translations bar
            for the {NON_EN_LANGS.length} other languages; click a chip to view the
            generated YAML. Auto-refreshes every 8s.
          </p>
        </header>

        {/* EN tiles */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Tile label="EN total"   value={total}             tone="neutral" />
          <Tile label="EN done"    value={enCounts.done}     tone="done" />
          <Tile label="EN running" value={enCounts.running}  tone="running" />
          <Tile label="EN failed"  value={enCounts.failed}   tone="failed" />
          <Tile label="EN pending" value={enCounts.pending}  tone="pending" />
        </section>

        {/* Translations summary line */}
        <p
          style={{
            marginBottom: 24,
            fontSize: 12,
            color: "#475569",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: "0.04em",
          }}
        >
          translations: <strong style={{ color: "#0F172A" }}>{trDone}</strong> done ·{" "}
          <strong style={{ color: "#0F172A" }}>{trStarted - trDone}</strong> in flight ·{" "}
          {trUniverse - trStarted} pending
          ({NON_EN_LANGS.map((l) => l.code).join(", ")})
        </p>

        {[...byCourse.entries()].map(([courseSlug, lessons]) => {
          const courseTitle = lessons[0]!.courseTitle;
          const bundleSlug = lessons[0]!.bundleSlug;
          return (
            <section
              key={courseSlug}
              style={{
                marginTop: 18,
                background: "#fff",
                border: "1px solid #E2E8F0",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748B",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {bundleSlug} · {courseSlug}
                </div>
                <h2 style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
                  {courseTitle}
                </h2>
              </div>
              <div>
                {lessons.map((e) => {
                  const enStatus = statusOfLang(e, "en", jobs);
                  const enJob = jobs.get(jobKey(e.courseSlug, e.lessonSlug, "en"));
                  const style = STATUS_STYLE[enStatus];
                  const enYamlHref =
                    enJob?.yaml_text || lessonYamlExists(e, "en")
                      ? textHref(e.courseSlug, e.lessonSlug, "en")
                      : null;
                  const enAudioCount = audioCoverage.get(
                    jobKey(e.courseSlug, e.lessonSlug, "en"),
                  ) ?? 0;

                  return (
                    <div
                      key={e.lessonSlug}
                      style={{
                        padding: "12px 16px",
                        borderTop: "1px solid #F1F5F9",
                      }}
                    >
                      {/* primary row */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "32px 1fr auto",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 12,
                            color: "#94A3B8",
                          }}
                        >
                          {String(e.lessonIndex).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: 14, color: "#0F172A", minWidth: 0 }}>
                          {e.lessonTitle}
                        </span>
                        <span
                          style={{
                            display: "inline-flex",
                            gap: 8,
                            alignItems: "center",
                            justifyContent: "flex-end",
                          }}
                        >
                          {enYamlHref ? (
                            <a
                              href={enYamlHref}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 11,
                                fontFamily: "ui-monospace, monospace",
                                color: "#4F46BA",
                                textDecoration: "none",
                              }}
                            >
                              view yaml
                            </a>
                          ) : null}
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              background: style.bg,
                              color: style.fg,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              fontFamily: "ui-monospace, monospace",
                            }}
                          >
                            {style.label}
                          </span>
                          {enAudioCount > 0 ? (
                            <span
                              title={`${enAudioCount} audio chunks generated`}
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "#EDE9FE",
                                color: "#5B21B6",
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: "ui-monospace, monospace",
                              }}
                            >
                              ♪ {enAudioCount}
                            </span>
                          ) : null}
                          <span
                            style={{
                              fontSize: 11,
                              color: "#64748B",
                              fontFamily: "ui-monospace, monospace",
                              minWidth: 110,
                              textAlign: "right",
                            }}
                          >
                            {enJob?.attempts ? `${enJob.attempts}× attempts` : ""}
                            {enJob?.finished_at
                              ? ` · ${new Date(enJob.finished_at).toLocaleTimeString()}`
                              : ""}
                          </span>
                        </span>
                      </div>

                      {/* error (EN) */}
                      {enJob?.error ? (
                        <div
                          style={{
                            marginTop: 6,
                            marginLeft: 44,
                            fontSize: 11,
                            color: "#991B1B",
                            fontFamily: "ui-monospace, monospace",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.4,
                          }}
                        >
                          {enJob.error.split("\n").slice(0, 3).join("\n")}
                        </div>
                      ) : null}

                      {/* translations bar */}
                      <div
                        style={{
                          marginTop: 8,
                          marginLeft: 44,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "ui-monospace, monospace",
                            color: "#94A3B8",
                            letterSpacing: "0.06em",
                            marginRight: 4,
                            textTransform: "uppercase",
                          }}
                        >
                          translations
                        </span>
                        {NON_EN_LANGS.map((lang) => {
                          const s = statusOfLang(e, lang.code, jobs);
                          const job = jobs.get(jobKey(e.courseSlug, e.lessonSlug, lang.code));
                          const ls = LANG_STYLE[s];
                          const hasYaml =
                            !!job?.yaml_text || lessonYamlExists(e, lang.code);
                          const audioCount =
                            audioCoverage.get(jobKey(e.courseSlug, e.lessonSlug, lang.code)) ?? 0;
                          const inner = (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "2px 7px",
                                borderRadius: 999,
                                background: ls.bg,
                                color: ls.fg,
                                fontSize: 10,
                                fontWeight: 700,
                                fontFamily: "ui-monospace, monospace",
                                letterSpacing: "0.04em",
                              }}
                              title={`${lang.label} · ${s}${job?.error ? ` · ${job.error.split("\n")[0]}` : ""}${audioCount > 0 ? ` · ♪ ${audioCount} chunks` : ""}`}
                            >
                              {lang.code} {ls.mark}
                              {audioCount > 0 ? (
                                <span style={{ color: "#5B21B6", marginLeft: 2 }}>♪</span>
                              ) : null}
                            </span>
                          );
                          return hasYaml ? (
                            <a
                              key={lang.code}
                              href={textHref(e.courseSlug, e.lessonSlug, lang.code)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: "none" }}
                            >
                              {inner}
                            </a>
                          ) : (
                            <span key={lang.code}>{inner}</span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "done" | "running" | "failed" | "pending";
}) {
  const fg =
    tone === "done"    ? "#166534" :
    tone === "running" ? "#1E40AF" :
    tone === "failed"  ? "#991B1B" :
    tone === "pending" ? "#475569" :
    "#0F172A";
  const bg =
    tone === "done"    ? "#DCFCE7" :
    tone === "running" ? "#DBEAFE" :
    tone === "failed"  ? "#FEE2E2" :
    tone === "pending" ? "#F1F5F9" :
    "#fff";
  return (
    <div
      style={{
        background: bg,
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: fg,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 2,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: fg,
          opacity: 0.75,
        }}
      >
        {label}
      </div>
    </div>
  );
}
