/** /yaml-status — read-only board showing how many lesson YAMLs have
 *  been generated vs. how many are still pending across the whole
 *  catalog. Public (matches /database-schema). Auto-refreshes every 8s
 *  via meta http-equiv refresh.
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

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

async function loadJobsByKey(): Promise<Map<string, JobRow>> {
  const admin = adminClient();
  if (!admin) return new Map();
  const { data } = await admin
    .from("yaml_generation_jobs")
    .select(
      "course_slug, lesson_slug, language, status, attempts, started_at, finished_at, yaml_path, error, model, updated_at",
    );
  const map = new Map<string, JobRow>();
  for (const j of (data ?? []) as JobRow[]) {
    map.set(`${j.course_slug}::${j.lesson_slug}::${j.language}`, j);
  }
  return map;
}

type Status = "done" | "running" | "failed" | "pending";

function statusFor(entry: LessonEntry, jobs: Map<string, JobRow>): Status {
  if (lessonYamlExists(entry, "en")) return "done";
  const job = jobs.get(`${entry.courseSlug}::${entry.lessonSlug}::en`);
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

export default async function YamlStatusPage() {
  const entries = enumerateAllLessons();
  const jobs = await loadJobsByKey();

  // Group by course for the table.
  const byCourse = new Map<string, LessonEntry[]>();
  for (const e of entries) {
    const arr = byCourse.get(e.courseSlug) ?? [];
    arr.push(e);
    byCourse.set(e.courseSlug, arr);
  }

  // Aggregate counts (English only — the canonical track).
  const counts: Record<Status, number> = { done: 0, running: 0, failed: 0, pending: 0 };
  for (const e of entries) counts[statusFor(e, jobs)]++;
  const total = entries.length;

  return (
    <main style={{ minHeight: "100dvh", background: "#FAFAFA", padding: "32px 16px 80px" }}>
      {/* Auto-refresh — gentle so it's not a server hammer. */}
      <meta httpEquiv="refresh" content="8" />

      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
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
            English (canonical) lessons across every bundle. Auto-refreshes every 8s.
            "Done" = on-disk YAML present (or job marked done by the API).
          </p>
        </header>

        {/* Counts */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <Tile label="Total"   value={total}             tone="neutral" />
          <Tile label="Done"    value={counts.done}       tone="done" />
          <Tile label="Running" value={counts.running}    tone="running" />
          <Tile label="Failed"  value={counts.failed}     tone="failed" />
          <Tile label="Pending" value={counts.pending}    tone="pending" />
        </section>

        {/* Per-course tables */}
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
              <div style={{ padding: 0 }}>
                {lessons.map((e) => {
                  const status = statusFor(e, jobs);
                  const job = jobs.get(`${e.courseSlug}::${e.lessonSlug}::en`);
                  const style = STATUS_STYLE[status];
                  return (
                    <div
                      key={e.lessonSlug}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 1fr 110px 130px",
                        gap: 12,
                        padding: "10px 16px",
                        borderTop: "1px solid #F1F5F9",
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
                          padding: "3px 10px",
                          borderRadius: 999,
                          background: style.bg,
                          color: style.fg,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textAlign: "center",
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {style.label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#64748B",
                          fontFamily: "ui-monospace, monospace",
                          textAlign: "right",
                        }}
                      >
                        {job?.attempts ? `${job.attempts}× attempts` : ""}
                        {job?.finished_at
                          ? ` · ${new Date(job.finished_at).toLocaleTimeString()}`
                          : ""}
                      </span>
                      {job?.error ? (
                        <div
                          style={{
                            gridColumn: "2 / -1",
                            marginTop: 4,
                            fontSize: 11,
                            color: "#991B1B",
                            fontFamily: "ui-monospace, monospace",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.4,
                          }}
                        >
                          {job.error.split("\n").slice(0, 3).join("\n")}
                        </div>
                      ) : null}
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
