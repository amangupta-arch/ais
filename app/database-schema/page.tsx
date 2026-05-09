import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Database schema — AIS" };

// ---- types ----------------------------------------------------------------

type BundleRow = {
  id: string;
  slug: string;
  plan_tier: string;
  order_index: number;
  is_published: boolean;
  bundle_type?: string | null;
  duration_days?: number | null;
  translations: Record<string, { title?: string; description?: string }>;
};

type CourseRow = {
  id: string;
  slug: string;
  plan_tier: string;
  bundle_id: string | null;
  order_index: number;
  emoji: string | null;
  is_published: boolean;
  lesson_count: number;
  translations: Record<string, { title?: string; subtitle?: string; description?: string }>;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  order_index: number;
  estimated_minutes: number;
  xp_reward: number;
  is_published: boolean;
  translations: Record<string, { title?: string; subtitle?: string }>;
};

type TurnRow = {
  id: string;
  lesson_id: string;
  translations: Record<string, unknown>;
  turn_type: string;
};

// ---- data fetching --------------------------------------------------------

async function loadAll() {
  const supabase = await createClient();
  const [bundles, courses, lessons, turns] = await Promise.all([
    supabase.from("bundles").select("*").order("order_index"),
    supabase.from("courses").select("*").order("order_index"),
    supabase.from("lessons").select("*").order("course_id").order("order_index"),
    // Just need translations + lesson_id for stats — keep payload small.
    supabase.from("lesson_turns").select("id, lesson_id, turn_type, translations"),
  ]);
  return {
    bundles: (bundles.data ?? []) as BundleRow[],
    courses: (courses.data ?? []) as CourseRow[],
    lessons: (lessons.data ?? []) as LessonRow[],
    turns: (turns.data ?? []) as TurnRow[],
  };
}

// ---- yaml file tree -------------------------------------------------------

const CONTENT_ROOT = fileURLToPath(new URL("../../supabase/content", import.meta.url));

type YamlFile = { path: string; size: number };
type YamlDir = { name: string; files: YamlFile[] };

function readYamlTree(): YamlDir[] {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(CONTENT_ROOT)
      .filter((n) => statSync(join(CONTENT_ROOT, n)).isDirectory())
      .sort();
  } catch {
    return [];
  }
  return dirs.map((name) => {
    const full = join(CONTENT_ROOT, name);
    let files: YamlFile[] = [];
    try {
      files = readdirSync(full)
        .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
        .sort()
        .map((f) => ({
          path: `${name}/${f}`,
          size: statSync(join(full, f)).size,
        }));
    } catch {
      /* ignore unreadable */
    }
    return { name, files };
  });
}

function readYamlFile(path: string): string | null {
  try {
    return readFileSync(join(CONTENT_ROOT, path), "utf8");
  } catch {
    return null;
  }
}

// ---- helpers --------------------------------------------------------------

function pickEnTitle(t: Record<string, { title?: string }>): string {
  return t.en?.title ?? Object.values(t)[0]?.title ?? "";
}

function languagesIn(translations: Record<string, unknown>): string[] {
  return Object.keys(translations);
}

// ---- page -----------------------------------------------------------------

type SearchParams = { yaml?: string };

export default async function DatabaseSchemaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const { bundles, courses, lessons, turns } = await loadAll();
  const yamlTree = readYamlTree();
  const openYaml = sp.yaml ? readYamlFile(sp.yaml) : null;

  // ---- summary stats ----
  const populatedBundles = new Set(courses.map((c) => c.bundle_id).filter(Boolean) as string[]);
  const orphanCourses = courses.filter((c) => !c.bundle_id);
  const bundledCourses = courses.filter((c) => c.bundle_id);

  // languages: union of every layer's translation keys
  const langSet = new Set<string>();
  for (const b of bundles) Object.keys(b.translations ?? {}).forEach((l) => langSet.add(l));
  for (const c of courses) Object.keys(c.translations ?? {}).forEach((l) => langSet.add(l));
  for (const l of lessons) Object.keys(l.translations ?? {}).forEach((l2) => langSet.add(l2));
  for (const t of turns) Object.keys(t.translations ?? {}).forEach((l) => langSet.add(l));
  const allLangs = [...langSet].sort();

  // per-language counts
  const langCounts = allLangs.map((lang) => ({
    lang,
    bundles: bundles.filter((b) => (b.translations ?? {})[lang]).length,
    courses: courses.filter((c) => (c.translations ?? {})[lang]).length,
    lessons: lessons.filter((l) => (l.translations ?? {})[lang]).length,
    turns: turns.filter((t) => (t.translations ?? {})[lang]).length,
  }));

  // bundle → courses, course → lessons indexes
  const coursesByBundle = new Map<string, CourseRow[]>();
  for (const c of courses) {
    if (!c.bundle_id) continue;
    const arr = coursesByBundle.get(c.bundle_id) ?? [];
    arr.push(c);
    coursesByBundle.set(c.bundle_id, arr);
  }
  const lessonsByCourse = new Map<string, LessonRow[]>();
  for (const l of lessons) {
    const arr = lessonsByCourse.get(l.course_id) ?? [];
    arr.push(l);
    lessonsByCourse.set(l.course_id, arr);
  }
  const turnsByLesson = new Map<string, TurnRow[]>();
  for (const t of turns) {
    const arr = turnsByLesson.get(t.lesson_id) ?? [];
    arr.push(t);
    turnsByLesson.set(t.lesson_id, arr);
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={{ marginBottom: 32 }}>
          <p style={eyebrowStyle}>live · {new Date().toISOString()}</p>
          <h1 style={titleStyle}>Database schema</h1>
          <p style={subtitleStyle}>
            Hierarchy: <code>Class → Book → Bundle → Course → Lesson</code>. Anything
            without a parent is an orphan. Translations live as jsonb on each row.
          </p>
        </header>

        {/* Layer counts */}
        <Section title="Counts">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Layer</Th><Th right>Total</Th><Th right>Populated</Th><Th right>Empty / orphan</Th>
              </tr>
            </thead>
            <tbody>
              <Row label="Class"   total={0}                  populated={0}                            empty={0}                               muted />
              <Row label="Book"    total={0}                  populated={0}                            empty={0}                               muted />
              <Row label="Bundle"  total={bundles.length}     populated={populatedBundles.size}        empty={bundles.length - populatedBundles.size} />
              <Row label="Course"  total={courses.length}     populated={bundledCourses.length}        empty={orphanCourses.length}            emptyLabel="orphan" />
              <Row label="Lesson"  total={lessons.length}     populated={lessons.length}               empty={0} />
              <Row label="Turn"    total={turns.length}       populated={turns.length}                 empty={0} />
            </tbody>
          </table>
        </Section>

        {/* Translations */}
        <Section title="Translations">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Language</Th>
                <Th right>Bundles</Th>
                <Th right>Courses</Th>
                <Th right>Lessons</Th>
                <Th right>Turns</Th>
              </tr>
            </thead>
            <tbody>
              {langCounts.map((lc) => (
                <tr key={lc.lang}>
                  <Td><code>{lc.lang}</code></Td>
                  <Td right>{lc.bundles}</Td>
                  <Td right>{lc.courses}</Td>
                  <Td right>{lc.lessons}</Td>
                  <Td right>{lc.turns}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Bundles */}
        <Section title={`Bundles (${bundles.length})`}>
          <p style={mutedStyle}>
            <strong>{populatedBundles.size}</strong> bundles have at least one course;
            the remaining <strong>{bundles.length - populatedBundles.size}</strong> are
            empty stubs.
          </p>
          {bundles.map((b) => {
            const bcourses = coursesByBundle.get(b.id) ?? [];
            return (
              <details key={b.id} style={detailsStyle}>
                <summary style={summaryStyle}>
                  <code>{b.slug}</code> · {b.plan_tier} · {bcourses.length} course
                  {bcourses.length === 1 ? "" : "s"} · {pickEnTitle(b.translations ?? {})}
                </summary>
                <div style={{ paddingLeft: 18, marginTop: 8 }}>
                  <p style={mutedStyle}>
                    languages: {Object.keys(b.translations ?? {}).join(", ") || "none"}
                  </p>
                  {bcourses.length === 0 ? (
                    <p style={mutedStyle}>No courses yet.</p>
                  ) : (
                    <ul style={listStyle}>
                      {bcourses.map((c) => {
                        const clessons = lessonsByCourse.get(c.id) ?? [];
                        return (
                          <li key={c.id} style={{ marginBottom: 4 }}>
                            <details>
                              <summary>
                                <code>{c.slug}</code> ({clessons.length} lesson{clessons.length === 1 ? "" : "s"}) — {pickEnTitle(c.translations ?? {})}
                              </summary>
                              <ul style={{ ...listStyle, paddingLeft: 18 }}>
                                {clessons.map((l) => {
                                  const tt = turnsByLesson.get(l.id) ?? [];
                                  const hasTrans = tt.some((t) => Object.keys(t.translations ?? {}).length > 0);
                                  return (
                                    <li key={l.id}>
                                      <code>{l.slug}</code> · {tt.length} turn{tt.length === 1 ? "" : "s"}
                                      {hasTrans ? " · 🌐 has translations" : ""}
                                    </li>
                                  );
                                })}
                              </ul>
                            </details>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </Section>

        {/* Orphan courses */}
        <Section title={`Orphan courses (${orphanCourses.length})`}>
          <p style={mutedStyle}>Courses with no bundle parent. Free-tier landing pages.</p>
          <ul style={listStyle}>
            {orphanCourses.map((c) => {
              const clessons = lessonsByCourse.get(c.id) ?? [];
              return (
                <li key={c.id}>
                  <details>
                    <summary>
                      <code>{c.slug}</code> · {c.plan_tier} · {clessons.length} lesson{clessons.length === 1 ? "" : "s"} — {pickEnTitle(c.translations ?? {})}
                    </summary>
                    <p style={{ ...mutedStyle, paddingLeft: 18 }}>
                      languages: {Object.keys(c.translations ?? {}).join(", ") || "none"}
                    </p>
                    {clessons.length > 0 ? (
                      <ul style={{ ...listStyle, paddingLeft: 18 }}>
                        {clessons.map((l) => {
                          const tt = turnsByLesson.get(l.id) ?? [];
                          const hasTrans = tt.some((t) => Object.keys(t.translations ?? {}).length > 0);
                          return (
                            <li key={l.id}>
                              <code>{l.slug}</code> · {tt.length} turn{tt.length === 1 ? "" : "s"}
                              {hasTrans ? " · 🌐 has translations" : ""}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* YAML files */}
        <Section title={`Raw YAML files (${yamlTree.reduce((n, d) => n + d.files.length, 0)})`}>
          <p style={mutedStyle}>
            Source-of-truth YAML for authored content under <code>supabase/content/</code>.
            Click a file to view it.
          </p>
          {yamlTree.map((d) => (
            <details key={d.name} style={detailsStyle}>
              <summary style={summaryStyle}>
                <code>{d.name}/</code> · {d.files.length} file{d.files.length === 1 ? "" : "s"}
              </summary>
              <ul style={{ ...listStyle, paddingLeft: 18 }}>
                {d.files.map((f) => {
                  const isOpen = sp.yaml === f.path;
                  return (
                    <li key={f.path}>
                      <a
                        href={isOpen ? "?" : `?yaml=${encodeURIComponent(f.path)}#yaml-${f.path}`}
                        style={{ color: isOpen ? "var(--text)" : "var(--indigo, #4f46e5)" }}
                      >
                        <code>{f.path}</code>
                      </a>
                      <span style={mutedInlineStyle}> · {f.size.toLocaleString()} B</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
          {sp.yaml && openYaml ? (
            <div style={yamlBlockStyle} id={`yaml-${sp.yaml}`}>
              <p style={eyebrowStyle}>{sp.yaml}</p>
              <pre style={preStyle}>{openYaml}</pre>
              <p style={{ marginTop: 8 }}>
                <a href="?">close</a>
              </p>
            </div>
          ) : null}
          {sp.yaml && !openYaml ? (
            <p style={mutedStyle}>File not found: <code>{sp.yaml}</code></p>
          ) : null}
        </Section>
      </div>
    </main>
  );
}

// ---- presentational primitives -------------------------------------------

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: "#fafafa",
  color: "#1e293b",
  fontFamily: "ui-sans-serif, system-ui, sans-serif",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 920,
  margin: "0 auto",
  padding: "32px 20px 80px",
};

const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  margin: "8px 0 12px",
  letterSpacing: "-0.02em",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#475569",
  lineHeight: 1.6,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#64748b",
};

const sectionStyle: React.CSSProperties = {
  marginTop: 32,
  padding: 20,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#ffffff",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  margin: "0 0 16px",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "1px solid #e2e8f0",
  fontWeight: 600,
  color: "#64748b",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 6px",
  borderBottom: "1px solid #f1f5f9",
};

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 12,
};

const mutedInlineStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
};

const detailsStyle: React.CSSProperties = {
  marginBottom: 6,
  fontSize: 14,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  padding: "4px 0",
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  fontSize: 13,
  color: "#475569",
};

const yamlBlockStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 8,
  fontSize: 12,
};

const preStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  margin: 0,
  maxHeight: 600,
  overflow: "auto",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {children}
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ ...thStyle, textAlign: right ? "right" : "left" }}>{children}</th>;
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td style={{ ...tdStyle, textAlign: right ? "right" : "left", fontVariantNumeric: right ? "tabular-nums" : undefined }}>{children}</td>;
}

function Row({
  label, total, populated, empty, muted, emptyLabel,
}: {
  label: string;
  total: number;
  populated: number;
  empty: number;
  muted?: boolean;
  emptyLabel?: string;
}) {
  return (
    <tr style={muted ? { opacity: 0.5 } : undefined}>
      <Td>{label}{muted ? " (table not yet created)" : ""}</Td>
      <Td right>{total}</Td>
      <Td right>{populated}</Td>
      <Td right>
        {empty} {emptyLabel ? <span style={mutedInlineStyle}>({emptyLabel})</span> : null}
      </Td>
    </tr>
  );
}
