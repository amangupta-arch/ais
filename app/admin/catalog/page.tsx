/** /admin/catalog — read-only admin dashboard listing every bundle,
 *  its courses, its lessons, and the tags on the bundle. Mirrors
 *  the shape of /yaml-status: admin-gated, service-role-fetched,
 *  auto-refreshes via `<meta http-equiv="refresh">` so it stays
 *  live without any client-side wiring.
 *
 *  What it surfaces per bundle:
 *   - slug + EN title + emoji + plan_tier
 *   - is_published, order_index
 *   - tags[] (chip row)
 *   - each course (slug, EN title, plan_tier, lesson_count from DB
 *     column, actual counted lessons, tags, is_published)
 *   - each lesson (slug, order_index, EN title, is_published,
 *     languages present in translations, estimated minutes, XP)
 *
 *  Counts at the top: total bundles / courses / lessons + how many
 *  are published. All reads go via the service-role client so this
 *  bypasses RLS (which now blocks anon reads on lesson_turns etc.).
 */

import { notFound, redirect } from "next/navigation";

import { createClient as createServiceClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";
// force-dynamic keeps the page uncached (fresh every request) —
// with the `<meta http-equiv="refresh">` below the browser reloads
// every 30 s. That's the "live" bit; no websocket needed.

// ---------------- data shapes ----------------

type BundleRow = {
  id: string;
  slug: string;
  plan_tier: string | null;
  emoji: string | null;
  order_index: number | null;
  is_published: boolean;
  tags: string[] | null;
  translations: Record<string, { title?: string; subtitle?: string }> | null;
};

type CourseRow = {
  id: string;
  bundle_id: string | null;
  slug: string;
  category: string | null;
  tags: string[] | null;
  plan_tier: string | null;
  emoji: string | null;
  order_index: number | null;
  is_published: boolean;
  lesson_count: number | null;
  translations: Record<string, { title?: string; subtitle?: string }> | null;
};

type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  order_index: number;
  is_published: boolean;
  estimated_minutes: number | null;
  xp_reward: number | null;
  translations: Record<string, { title?: string; subtitle?: string }> | null;
};

// ---------------- data loading ----------------

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

// Fetch every row of a table in 1000-row pages. Supabase Cloud
// silently caps un-ranged SELECTs at max-rows server-side, so an
// un-paginated .select() will truncate once the lessons table grows
// past the cap. Same pattern as app/database-schema/page.tsx.
type AdminClient = NonNullable<ReturnType<typeof adminClient>>;

async function fetchAll<T>(
  admin: AdminClient,
  table: string,
  select: string,
  orderBy: { column: string; ascending: boolean; nullsFirst?: boolean },
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from(table)
      .select(select)
      .order(orderBy.column, {
        ascending: orderBy.ascending,
        nullsFirst: orderBy.nullsFirst ?? false,
      })
      .range(offset, offset + pageSize - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
  }
  return all;
}

async function loadCatalog(): Promise<{
  bundles: BundleRow[];
  coursesByBundle: Map<string | null, CourseRow[]>;
  lessonsByCourse: Map<string, LessonRow[]>;
}> {
  const admin = adminClient();
  if (!admin) {
    return {
      bundles: [],
      coursesByBundle: new Map(),
      lessonsByCourse: new Map(),
    };
  }

  const [bundles, courses, lessons] = await Promise.all([
    fetchAll<BundleRow>(
      admin,
      "bundles",
      "id, slug, plan_tier, emoji, order_index, is_published, tags, translations",
      { column: "order_index", ascending: true },
    ),
    fetchAll<CourseRow>(
      admin,
      "courses",
      "id, bundle_id, slug, category, tags, plan_tier, emoji, order_index, is_published, lesson_count, translations",
      { column: "order_index", ascending: true },
    ),
    fetchAll<LessonRow>(
      admin,
      "lessons",
      "id, course_id, slug, order_index, is_published, estimated_minutes, xp_reward, translations",
      { column: "order_index", ascending: true },
    ),
  ]);

  const coursesByBundle = new Map<string | null, CourseRow[]>();
  for (const c of courses) {
    const k = c.bundle_id;
    const arr = coursesByBundle.get(k);
    if (arr) arr.push(c);
    else coursesByBundle.set(k, [c]);
  }
  const lessonsByCourse = new Map<string, LessonRow[]>();
  for (const l of lessons) {
    const arr = lessonsByCourse.get(l.course_id);
    if (arr) arr.push(l);
    else lessonsByCourse.set(l.course_id, [l]);
  }

  return { bundles, coursesByBundle, lessonsByCourse };
}

// ---------------- helpers ----------------

function enTitle(
  translations: Record<string, { title?: string }> | null | undefined,
  fallback: string,
): string {
  return translations?.en?.title ?? fallback;
}

function languagesPresent(
  translations: Record<string, { title?: string }> | null | undefined,
): string[] {
  if (!translations) return [];
  return Object.keys(translations).sort();
}

// ---------------- page ----------------

export default async function AdminCatalogPage() {
  // Admin-only, matching /update-yaml + /yaml-generate. Non-admin
  // signed-in visitors get 404 (doesn't reveal the route exists).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/catalog");
  if (!isAdminEmail(user.email)) notFound();

  const { bundles, coursesByBundle, lessonsByCourse } = await loadCatalog();

  const orphanCourses = coursesByBundle.get(null) ?? [];

  const totalBundles = bundles.length;
  const publishedBundles = bundles.filter((b) => b.is_published).length;
  const totalCourses =
    [...coursesByBundle.values()].reduce((sum, arr) => sum + arr.length, 0);
  const publishedCourses = [...coursesByBundle.values()]
    .flat()
    .filter((c) => c.is_published).length;
  const totalLessons = [...lessonsByCourse.values()].reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const publishedLessons = [...lessonsByCourse.values()]
    .flat()
    .filter((l) => l.is_published).length;

  return (
    <>
      {/* Full-page reload every 30s. Preserves any query params if
          we add filters later; matches the /yaml-status pattern. */}
      <meta httpEquiv="refresh" content="30" />
      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px 96px",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: "#111",
        }}
      >
        <header style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: 6,
            }}
          >
            Internal · admin · auto-refresh 30s
          </p>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: "-0.01em",
            }}
          >
            Catalog
          </h1>
          <p style={{ fontSize: 14, color: "#444", lineHeight: 1.5 }}>
            Every bundle in the DB, its courses, and the lessons under
            each course. Counts on the right are (published / total).
          </p>
        </header>

        <StatsRow
          items={[
            {
              label: "Bundles",
              value: `${publishedBundles} / ${totalBundles}`,
            },
            {
              label: "Courses",
              value: `${publishedCourses} / ${totalCourses}`,
            },
            {
              label: "Lessons",
              value: `${publishedLessons} / ${totalLessons}`,
            },
            {
              label: "Orphan courses",
              value: String(orphanCourses.length),
              muted: orphanCourses.length === 0,
            },
          ]}
        />

        <section style={{ marginTop: 32 }}>
          {bundles.map((b) => {
            const bTitle = enTitle(b.translations, b.slug);
            const courses = coursesByBundle.get(b.id) ?? [];
            return (
              <BundleBlock
                key={b.id}
                bundle={b}
                title={bTitle}
                courses={courses}
                lessonsByCourse={lessonsByCourse}
              />
            );
          })}

          {orphanCourses.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 12,
                  color: "#8a0000",
                }}
              >
                Orphan courses ({orphanCourses.length})
              </h2>
              <p
                style={{ fontSize: 13, color: "#666", marginBottom: 12 }}
              >
                Courses with no <code>bundle_id</code>. These don&apos;t
                show up under any bundle in student-facing routing.
              </p>
              {orphanCourses.map((c) => (
                <OrphanCourseRow
                  key={c.id}
                  course={c}
                  lessons={lessonsByCourse.get(c.id) ?? []}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

// ---------------- presentation ----------------

function StatsRow({
  items,
}: {
  items: Array<{ label: string; value: string; muted?: boolean }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 12,
        marginBottom: 8,
      }}
    >
      {items.map((it) => (
        <div
          key={it.label}
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            padding: "12px 14px",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#888",
            }}
          >
            {it.label}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginTop: 4,
              color: it.muted ? "#999" : "#111",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function BundleBlock({
  bundle,
  title,
  courses,
  lessonsByCourse,
}: {
  bundle: BundleRow;
  title: string;
  courses: CourseRow[];
  lessonsByCourse: Map<string, LessonRow[]>;
}) {
  const tags = bundle.tags ?? [];
  const lessonTotal = courses.reduce(
    (sum, c) => sum + (lessonsByCourse.get(c.id)?.length ?? 0),
    0,
  );
  return (
    <details
      open={false}
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 10,
        background: bundle.is_published ? "#fff" : "#fff7f7",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 20 }}>{bundle.emoji ?? "📦"}</span>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: bundle.is_published ? "#111" : "#a00",
          }}
        >
          {title}
        </span>
        <span
          style={{ fontSize: 12, color: "#888", fontFamily: "monospace" }}
        >
          {bundle.slug}
        </span>
        <PlanTierChip tier={bundle.plan_tier} />
        {!bundle.is_published && <DraftChip />}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#666",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {courses.length} courses · {lessonTotal} lessons
        </span>
      </summary>

      {tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 10,
          }}
        >
          {tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {courses.length === 0 ? (
          <p style={{ fontSize: 13, color: "#999" }}>
            No courses yet.
          </p>
        ) : (
          courses.map((c) => (
            <CourseRowView
              key={c.id}
              course={c}
              lessons={lessonsByCourse.get(c.id) ?? []}
            />
          ))
        )}
      </div>
    </details>
  );
}

function CourseRowView({
  course,
  lessons,
}: {
  course: CourseRow;
  lessons: LessonRow[];
}) {
  const title = enTitle(course.translations, course.slug);
  return (
    <details
      style={{
        borderLeft: "3px solid #e5e5e5",
        margin: "8px 0 8px 8px",
        padding: "8px 12px",
        background: course.is_published ? "#fbfbfb" : "#fff5f5",
        borderRadius: 6,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 16 }}>{course.emoji ?? "📘"}</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: course.is_published ? "#111" : "#a00",
          }}
        >
          {title}
        </span>
        <span
          style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}
        >
          {course.slug}
        </span>
        <PlanTierChip tier={course.plan_tier} />
        {!course.is_published && <DraftChip />}
        <span
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#666",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {lessons.length} lessons
          {typeof course.lesson_count === "number" &&
            course.lesson_count !== lessons.length && (
              <span style={{ color: "#c60" }}>
                {" "}
                (col says {course.lesson_count})
              </span>
            )}
        </span>
      </summary>

      {(course.tags?.length ?? 0) > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginTop: 8,
          }}
        >
          {(course.tags ?? []).map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      )}

      {lessons.length > 0 && (
        <table
          style={{
            width: "100%",
            marginTop: 10,
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={cellHeader}>#</th>
              <th style={cellHeader}>Title</th>
              <th style={cellHeader}>Slug</th>
              <th style={cellHeader}>Langs</th>
              <th style={{ ...cellHeader, textAlign: "right" }}>Min</th>
              <th style={{ ...cellHeader, textAlign: "right" }}>XP</th>
              <th style={cellHeader}>State</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => {
              const lTitle = enTitle(l.translations, l.slug);
              const langs = languagesPresent(l.translations);
              return (
                <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={cellNum}>{l.order_index}</td>
                  <td style={cell}>{lTitle}</td>
                  <td style={cellMono}>{l.slug}</td>
                  <td style={cell}>
                    <span style={{ color: "#666" }}>
                      {langs.length > 0 ? langs.join(", ") : "—"}
                    </span>
                  </td>
                  <td style={cellNumRight}>
                    {l.estimated_minutes ?? "—"}
                  </td>
                  <td style={cellNumRight}>{l.xp_reward ?? "—"}</td>
                  <td style={cell}>
                    {l.is_published ? (
                      <span style={{ color: "#0a7" }}>published</span>
                    ) : (
                      <span style={{ color: "#a00" }}>draft</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </details>
  );
}

function OrphanCourseRow({
  course,
  lessons,
}: {
  course: CourseRow;
  lessons: LessonRow[];
}) {
  return <CourseRowView course={course} lessons={lessons} />;
}

function PlanTierChip({ tier }: { tier: string | null }) {
  if (!tier) return null;
  const color =
    tier === "basic"
      ? { fg: "#0a7", bg: "#e6f7f0" }
      : tier === "advanced"
        ? { fg: "#7a3", bg: "#f0f7e6" }
        : tier === "student"
          ? { fg: "#36c", bg: "#e6ecf7" }
          : { fg: "#666", bg: "#f0f0f0" };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: color.fg,
        background: color.bg,
        padding: "2px 6px",
        borderRadius: 4,
      }}
    >
      {tier}
    </span>
  );
}

function DraftChip() {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "#a00",
        background: "#fee",
        padding: "2px 6px",
        borderRadius: 4,
      }}
    >
      draft
    </span>
  );
}

function TagChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: "#333",
        background: "#f0f0f0",
        border: "1px solid #e0e0e0",
        padding: "2px 8px",
        borderRadius: 999,
      }}
    >
      {label}
    </span>
  );
}

const cellHeader: React.CSSProperties = {
  padding: "6px 8px",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const cell: React.CSSProperties = { padding: "6px 8px" };
const cellNum: React.CSSProperties = {
  padding: "6px 8px",
  fontVariantNumeric: "tabular-nums",
  color: "#666",
  width: 32,
};
const cellNumRight: React.CSSProperties = {
  padding: "6px 8px",
  fontVariantNumeric: "tabular-nums",
  color: "#666",
  textAlign: "right",
  width: 60,
};
const cellMono: React.CSSProperties = {
  padding: "6px 8px",
  fontFamily: "monospace",
  color: "#888",
  fontSize: 11,
};
