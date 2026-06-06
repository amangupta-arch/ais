/** /yaml-status — read-only board showing how many lesson YAMLs have
 *  been generated vs. how many are still pending across the whole
 *  catalog. Public (matches /database-schema). Auto-refreshes every 8s
 *  via meta http-equiv refresh (which preserves query params, so the
 *  filter selection survives the reload).
 *
 *  Each row carries:
 *   - the EN status badge (primary)
 *   - a small per-language strip below for non-EN languages, each
 *     clickable to view the generated YAML if available
 *
 *  Filters (URL searchParams):
 *   - ?status=done|running|failed|pending — narrows the EN status
 *   - ?bundle=<slug> — narrows to one bundle
 *   - ?board=<slug> — narrows to bundles tagged for a board
 *   - ?medium=<code> — narrows to bundles tagged for a medium
 *
 *  Counts on the tiles reflect any active bundle/board/medium filter,
 *  so "EN pending 47" means "47 pending in the current narrowed set",
 *  not 47 across the entire catalog.
 */

import { redirect } from "next/navigation";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { LANGUAGE_OPTIONS } from "@/app/update-yaml/constants";
import {
  enumerateAllLessons,
  lessonYamlExists,
  type LessonEntry,
} from "@/lib/yaml-generation/catalog";

import Filters from "./Filters";

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

/** slug → display title for every bundle in the DB. Mirrors the loader
 *  in app/yaml-generate/page.tsx so the bundle filter dropdown shows
 *  human titles instead of raw slugs. */
async function loadBundleTitleMap(): Promise<Map<string, string>> {
  const admin = adminClient();
  if (!admin) return new Map();
  const { data } = await admin.from("bundles").select("slug, translations");
  const map = new Map<string, string>();
  for (const b of data ?? []) {
    const t =
      (b.translations as Record<string, { title?: string }> | null) ?? {};
    map.set(b.slug as string, t.en?.title ?? (b.slug as string));
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

export default async function YamlStatusPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    bundle?: string;
    course?: string;
    board?: string;
    medium?: string;
  }>;
}) {
  // Admin-only: leaks catalogue + authoring state.
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login?next=/yaml-status");
  if (!isAdminEmail(user.email)) redirect("/student");

  const sp = await searchParams;
  const statusFilter: Status | null =
    sp.status === "done" || sp.status === "running" || sp.status === "failed" || sp.status === "pending"
      ? sp.status
      : null;

  const allEntries = enumerateAllLessons();
  const [jobs, audioCoverage, bundleTitleMap] = await Promise.all([
    loadJobsByKey(),
    loadAudioCoverage(),
    loadBundleTitleMap(),
  ]);

  // ── Filter validation ─────────────────────────────────────────────
  // Drop URL params that don't reference anything in the catalog —
  // they're either typos, stale, or orphaned from a parent filter
  // change. The dropdown will quietly snap to "All …" for that
  // dimension instead of showing a stuck-on-an-empty-result state.
  const rawBundle = sp.bundle?.trim() || null;
  const rawCourse = sp.course?.trim() || null;
  const rawBoard = sp.board?.trim() || null;
  const rawMedium = sp.medium?.trim() || null;

  const bundleFilter = rawBundle && allEntries.some((e) => e.bundleSlug === rawBundle) ? rawBundle : null;
  const courseFilter = rawCourse && allEntries.some((e) => e.courseSlug === rawCourse) ? rawCourse : null;
  const boardFilter = rawBoard && allEntries.some((e) => e.bundleBoards.includes(rawBoard)) ? rawBoard : null;
  const mediumFilter = rawMedium && allEntries.some((e) => e.bundleMediums.includes(rawMedium)) ? rawMedium : null;

  // ── Cascading option lists (faceted filtering) ────────────────────
  // For each dimension, compute the available options by narrowing the
  // catalog with all OTHER active filters. This is what "nested logic"
  // means in practice: picking Bundle=X collapses Course/Board/Medium
  // to only the values that exist *within* X.
  const narrowExcept = (
    skip: "bundle" | "course" | "board" | "medium",
  ): LessonEntry[] =>
    allEntries.filter((e) => {
      if (skip !== "bundle" && bundleFilter && e.bundleSlug !== bundleFilter) return false;
      if (skip !== "course" && courseFilter && e.courseSlug !== courseFilter) return false;
      if (skip !== "board"  && boardFilter  && !e.bundleBoards.includes(boardFilter)) return false;
      if (skip !== "medium" && mediumFilter && !e.bundleMediums.includes(mediumFilter)) return false;
      return true;
    });

  const bundleOptionMap = new Map<string, string>();
  for (const e of narrowExcept("bundle")) {
    if (!bundleOptionMap.has(e.bundleSlug)) {
      bundleOptionMap.set(e.bundleSlug, bundleTitleMap.get(e.bundleSlug) ?? e.bundleSlug);
    }
  }
  const bundleOptions = [...bundleOptionMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const courseOptionMap = new Map<string, string>();
  for (const e of narrowExcept("course")) {
    if (!courseOptionMap.has(e.courseSlug)) courseOptionMap.set(e.courseSlug, e.courseTitle);
  }
  const courseOptions = [...courseOptionMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const boardSet = new Set<string>();
  for (const e of narrowExcept("board")) for (const b of e.bundleBoards) boardSet.add(b);
  const boardOptions = [...boardSet].sort();

  const mediumSet = new Set<string>();
  for (const e of narrowExcept("medium")) for (const m of e.bundleMediums) mediumSet.add(m);
  const mediumOptions = [...mediumSet].sort();

  // ── Final narrowing (all 4 filters applied) ──────────────────────
  const narrowed = allEntries.filter((e) => {
    if (bundleFilter && e.bundleSlug !== bundleFilter) return false;
    if (courseFilter && e.courseSlug !== courseFilter) return false;
    if (boardFilter && !e.bundleBoards.includes(boardFilter)) return false;
    if (mediumFilter && !e.bundleMediums.includes(mediumFilter)) return false;
    return true;
  });

  // Counts reflect bundle/course/board/medium filters but NOT the
  // status filter — so each tile shows how many lessons would land in
  // that status bucket within the narrowed set.
  const enCounts: Record<Status, number> = { done: 0, running: 0, failed: 0, pending: 0 };
  for (const e of narrowed) enCounts[statusOfLang(e, "en", jobs)]++;
  const total = narrowed.length;

  // Final visible set: also apply status filter (if any).
  const visible = statusFilter
    ? narrowed.filter((e) => statusOfLang(e, "en", jobs) === statusFilter)
    : narrowed;

  // Group by course (only courses with at least one visible lesson).
  const byCourse = new Map<string, LessonEntry[]>();
  for (const e of visible) {
    const arr = byCourse.get(e.courseSlug) ?? [];
    arr.push(e);
    byCourse.set(e.courseSlug, arr);
  }

  // Translations summary across all non-EN languages, computed on the
  // narrowed set so the line agrees with the EN tiles when filters are
  // active.
  let trDone = 0;
  let trStarted = 0;
  const trUniverse = narrowed.length * NON_EN_LANGS.length;
  for (const e of narrowed) {
    for (const l of NON_EN_LANGS) {
      const s = statusOfLang(e, l.code, jobs);
      if (s !== "pending") trStarted++;
      if (s === "done") trDone++;
    }
  }

  // Helper: build a /yaml-status URL preserving the other active
  // filters but flipping just `status`. Used by the clickable tiles.
  const statusHref = (s: Status | null) => {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (bundleFilter) params.set("bundle", bundleFilter);
    if (courseFilter) params.set("course", courseFilter);
    if (boardFilter) params.set("board", boardFilter);
    if (mediumFilter) params.set("medium", mediumFilter);
    const qs = params.toString();
    return qs ? `/yaml-status?${qs}` : "/yaml-status";
  };

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
            generated YAML. Click a tile to filter. Auto-refreshes every 8s.
          </p>
        </header>

        <Filters
          bundles={bundleOptions}
          courses={courseOptions}
          boards={boardOptions}
          mediums={mediumOptions}
        />

        {/* EN tiles — each is a clickable filter link. Active status
            tile is highlighted; clicking it again (or "EN total")
            clears the status filter. */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Tile label="EN total"   value={total}             tone="neutral" href={statusHref(null)}       active={statusFilter === null} />
          <Tile label="EN done"    value={enCounts.done}     tone="done"    href={statusHref("done")}     active={statusFilter === "done"} />
          <Tile label="EN running" value={enCounts.running}  tone="running" href={statusHref("running")}  active={statusFilter === "running"} />
          <Tile label="EN failed"  value={enCounts.failed}   tone="failed"  href={statusHref("failed")}   active={statusFilter === "failed"} />
          <Tile label="EN pending" value={enCounts.pending}  tone="pending" href={statusHref("pending")}  active={statusFilter === "pending"} />
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

        {byCourse.size === 0 && (
          <div
            style={{
              marginTop: 18,
              padding: "32px 16px",
              background: "#fff",
              border: "1px dashed #CBD5E1",
              borderRadius: 12,
              textAlign: "center",
              color: "#64748B",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            No lessons match these filters.{" "}
            <a href="/yaml-status" style={{ color: "#4F46BA", fontWeight: 600 }}>
              Clear filters
            </a>
            .
          </div>
        )}

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
  href,
  active,
}: {
  label: string;
  value: number;
  tone: "neutral" | "done" | "running" | "failed" | "pending";
  /** When provided the tile renders as an anchor — clicking it sets
   *  (or clears) the ?status= filter. */
  href?: string;
  /** Highlight the currently-selected status filter tile. */
  active?: boolean;
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
  const content = (
    <>
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
    </>
  );
  const baseStyle: React.CSSProperties = {
    background: bg,
    border: active ? `2px solid ${fg}` : "1px solid #E2E8F0",
    borderRadius: 12,
    padding: active ? 13 : 14,
    display: "block",
    textDecoration: "none",
    transition: "transform 120ms ease",
  };
  if (href) {
    return (
      <a href={href} style={{ ...baseStyle, cursor: "pointer" }}>
        {content}
      </a>
    );
  }
  return <div style={baseStyle}>{content}</div>;
}
