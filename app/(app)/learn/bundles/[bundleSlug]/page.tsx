import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Heart,
  Lock,
  MoreHorizontal,
  Play,
  Sparkles,
  Trophy,
  Volume2,
} from "lucide-react";

import {
  getBundleBySlug,
  getLessonsByCourseId,
  getMe,
  getMyCourseProgress,
} from "@/lib/supabase/queries";
import {
  bundleDescription,
  bundleTitle,
  courseSubtitle,
  courseTitle,
} from "@/lib/types";
import { tierCanAccess, type Course, type Lesson, type PlanTier, type UserCourseProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

type Hue = "indigo" | "moss" | "saffron" | "coral" | "ocean" | "plum";

function hueForGradient(g: string | null | undefined): Hue {
  switch (g) {
    case "ember": return "saffron";
    case "moss":  return "moss";
    case "plum":  return "plum";
    case "ocean": return "ocean";
    case "coral": return "coral";
    case "paper": return "indigo";
    default:      return "indigo";
  }
}

/** Cycle through hues so adjacent course tiles don't repeat. */
const TILE_HUES: Hue[] = ["indigo", "plum", "ocean", "saffron", "coral", "moss"];

function tileHueForCourse(course: Course, fallbackIdx: number): Hue {
  const fromGradient = course.cover_gradient ? hueForGradient(course.cover_gradient) : null;
  return fromGradient ?? TILE_HUES[fallbackIdx % TILE_HUES.length]!;
}

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ bundleSlug: string }>;
}) {
  const { bundleSlug } = await params;
  const { user, profile, planIds } = await getMe();
  if (!user) redirect("/login");

  const { bundle, courses } = await getBundleBySlug(bundleSlug);
  if (!bundle) notFound();

  const lang = profile?.preferred_language ?? "en";
  const tiers: PlanTier[] = planIds;
  const bundleLocked = !tierCanAccess(tiers, bundle.plan_tier);
  const heroHue = hueForGradient(bundle.cover_gradient);

  const progress = await getMyCourseProgress();
  const progByCourse = new Map<string, UserCourseProgress>(
    progress.map((p) => [p.course_id, p]),
  );

  const totalMinutes = courses.reduce((sum, c) => sum + (c.estimated_minutes ?? 0), 0);
  const totalLessons = courses.reduce((sum, c) => sum + (c.lesson_count ?? 0), 0);
  const totalHours = totalMinutes / 60;
  const startedCount = courses.filter((c) => progByCourse.get(c.id)?.started_at).length;
  const overallPct = courses.length
    ? Math.round(
        courses.reduce((s, c) => s + (progByCourse.get(c.id)?.progress_pct ?? 0), 0) /
          courses.length,
      )
    : 0;
  const hasAnyProgress = startedCount > 0;

  // Pick the "current" course: first in_progress, else first not-yet-started unlocked.
  const currentCourse =
    courses.find((c) => progByCourse.get(c.id)?.status === "in_progress") ??
    courses.find(
      (c) =>
        !progByCourse.get(c.id)?.completed_at &&
        tierCanAccess(tiers, c.plan_tier) &&
        !bundleLocked,
    ) ??
    null;

  // For the sticky resume CTA, look up the in_progress course's lessons so we
  // can render "Continue · <course> · L<n> of <m>".
  let resumeTarget: {
    course: Course;
    lesson: Lesson;
    lessonIndex: number;
    totalLessons: number;
  } | null = null;
  const resumeCourse =
    courses.find((c) => progByCourse.get(c.id)?.status === "in_progress") ?? null;
  if (resumeCourse) {
    const cp = progByCourse.get(resumeCourse.id);
    const lessons = await getLessonsByCourseId(resumeCourse.id);
    if (lessons.length > 0) {
      const lastIdx = cp?.last_lesson_id
        ? lessons.findIndex((l) => l.id === cp.last_lesson_id)
        : -1;
      const idx = lastIdx >= 0 ? lastIdx : 0;
      resumeTarget = {
        course: resumeCourse,
        lesson: lessons[idx]!,
        lessonIndex: idx + 1,
        totalLessons: lessons.length,
      };
    }
  }

  const heroBg = `linear-gradient(135deg, var(--${heroHue}-deep), var(--plum-deep))`;

  return (
    <main className="lm-page" style={{ paddingBottom: resumeTarget ? 96 : 56 }}>
      {/* ---------- Top header ---------- */}
      <div
        className="flex items-center"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "var(--bg)",
          borderBottom: "1px solid var(--border-soft)",
          padding: "12px 16px",
          gap: 8,
        }}
      >
        <Link
          href="/learn"
          aria-label="Back to library"
          className="inline-flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-2)",
            color: "var(--text-2)",
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div style={{ flex: 1, textAlign: "center" }}>
          {/* Bundle progress, kept terse so it lives happily in the
              eyebrow slot. "The library" was redundant with the back
              arrow; this slot now carries something the learner
              actually wants to know — am I making progress? */}
          <p className="lm-eyebrow">
            {overallPct >= 100
              ? "complete"
              : !hasAnyProgress
              ? "not started"
              : `${overallPct}% complete`}
          </p>
        </div>
        <button
          aria-label="More options"
          className="inline-flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--r-2)",
            background: "transparent",
            border: 0,
            color: "var(--text-3)",
            cursor: "pointer",
          }}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto" style={{ maxWidth: 640, padding: "20px 20px 0" }}>
        {/* ---------- Hero ---------- */}
        <section
          style={{
            position: "relative",
            borderRadius: "var(--r-5)",
            padding: "28px 28px 32px",
            color: "#fff",
            background: heroBg,
            overflow: "hidden",
            boxShadow: "var(--shadow-2)",
          }}
        >
          {/* Decorative orbits */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              pointerEvents: "none",
            }}
          >
            <svg viewBox="0 0 220 220" width="220" height="220">
              <circle cx="110" cy="110" r="100" fill="none" stroke="rgba(255,255,255,0.16)" strokeDasharray="2 6" />
              <circle cx="110" cy="110" r="74"  fill="none" stroke="rgba(255,255,255,0.20)" strokeDasharray="2 4" />
              <circle cx="110" cy="110" r="48"  fill="none" stroke="rgba(255,255,255,0.22)" strokeDasharray="2 3" />
              <circle cx="146" cy="78"  r="9"   fill="var(--saffron)" />
            </svg>
          </div>

          <span
            className="inline-flex items-center"
            style={{
              gap: 8,
              padding: "8px 14px",
              borderRadius: "var(--r-pill)",
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--saffron)" }} />
            Bundle · {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>

          <h1
            className="lm-serif"
            style={{
              marginTop: 24,
              fontSize: 44,
              lineHeight: 1.05,
              maxWidth: "85%",
              position: "relative",
            }}
          >
            {bundleTitle(bundle, lang)}
          </h1>
          {bundleDescription(bundle, lang) ? (
            <p
              className="lm-serif"
              style={{
                marginTop: 12,
                fontSize: 16,
                fontStyle: "italic",
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.78)",
                maxWidth: "90%",
              }}
            >
              {bundleDescription(bundle, lang)}
            </p>
          ) : null}
        </section>

        {/* ---------- Stats row ---------- */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
          }}
        >
          <StatTile value={courses.length} label="courses" />
          <StatTile value={totalLessons} label="lessons" />
          <StatTile
            value={totalHours >= 10 ? Math.round(totalHours).toString() : totalHours.toFixed(1)}
            label="hours"
          />
          <StatTile value={courses.length} label="certs" />
        </div>

        {/* ---------- Bundle progress ---------- */}
        {hasAnyProgress ? (
          <section
            style={{
              marginTop: 16,
              padding: 18,
              borderRadius: "var(--r-4)",
              background: "var(--indigo-soft)",
            }}
          >
            <div className="flex items-center" style={{ justifyContent: "space-between" }}>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--indigo-deep)",
                }}
              >
                Bundle progress
              </p>
              <p className="lm-mono lm-tabular" style={{ fontSize: 14, color: "var(--indigo-deep)" }}>
                {overallPct}% <span style={{ opacity: 0.55 }}>· {startedCount} / {courses.length} started</span>
              </p>
            </div>
            <div
              style={{
                marginTop: 12,
                height: 8,
                borderRadius: "var(--r-pill)",
                background: "rgba(46, 39, 122, 0.15)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${overallPct}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, var(--indigo-deep), var(--indigo))",
                  borderRadius: "var(--r-pill)",
                }}
              />
            </div>
            <div
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: `repeat(${courses.length}, 1fr)`,
                gap: 6,
              }}
            >
              {courses.map((c) => {
                const pct = progByCourse.get(c.id)?.progress_pct ?? 0;
                return (
                  <div
                    key={c.id}
                    style={{
                      height: 4,
                      borderRadius: "var(--r-pill)",
                      background: "rgba(46, 39, 122, 0.12)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${pct}%`,
                        height: "100%",
                        background: "var(--indigo)",
                        borderRadius: "var(--r-pill)",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ---------- Course list ---------- */}
        <section style={{ marginTop: 32 }}>
          <p className="lm-eyebrow">courses · in suggested order</p>
          {courses.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 14, color: "var(--text-2)" }}>
              Courses are being authored. Check back soon.
            </p>
          ) : (
            <ol className="flex flex-col" style={{ gap: 12, marginTop: 12 }}>
              {courses.map((c, i) => (
                <li key={c.id}>
                  <CourseRow
                    course={c}
                    index={i}
                    bundleLocked={bundleLocked}
                    tiers={tiers}
                    progress={progByCourse.get(c.id) ?? null}
                    isCurrent={currentCourse?.id === c.id}
                    lang={lang}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ---------- What's inside ---------- */}
        <section style={{ marginTop: 32 }}>
          <p className="lm-eyebrow">what's inside</p>
          <div
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: "var(--r-4)",
              background: "var(--bg-soft)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <FeatureRow
              icon={<Sparkles className="h-4 w-4" />}
              hue="indigo"
              title="AI tutor on every lesson"
              subtitle="Nova answers in your language"
            />
            <FeatureRow
              icon={<Volume2 className="h-4 w-4" />}
              hue="plum"
              title="Voice narration unlocked"
              subtitle="Listen along in 10 languages"
            />
            <FeatureRow
              icon={<Trophy className="h-4 w-4" />}
              hue="saffron"
              title={`${courses.length} certificates of completion`}
              subtitle="Shareable on LinkedIn & profile"
            />
            <FeatureRow
              icon={<Heart className="h-4 w-4" />}
              hue="coral"
              title="Lifetime access"
              subtitle="Re-take any course, any time"
            />
          </div>
        </section>
      </div>

      {/* ---------- Sticky resume CTA ---------- */}
      {resumeTarget ? (
        <Link
          href={`/learn/${resumeTarget.course.slug}/${resumeTarget.lesson.slug}`}
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 16,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 20px",
            borderRadius: "var(--r-pill)",
            background: "linear-gradient(90deg, var(--indigo-deep), var(--plum))",
            color: "#fff",
            textDecoration: "none",
            boxShadow: "0 8px 24px rgba(46, 39, 122, 0.35)",
            maxWidth: 608,
            margin: "0 auto",
          }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: "999px",
              background: "rgba(255,255,255,0.18)",
              flexShrink: 0,
            }}
          >
            <Play className="h-4 w-4" style={{ marginLeft: 2 }} />
          </span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: 16, minWidth: 0 }}>
            <span style={{ opacity: 0.9, fontWeight: 600 }}>Continue · </span>
            <span
              style={{
                display: "inline-block",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                verticalAlign: "bottom",
              }}
            >
              {courseTitle(resumeTarget.course, lang)}
            </span>
          </span>
          <span
            className="lm-mono lm-tabular"
            style={{ fontSize: 13, opacity: 0.85, flexShrink: 0 }}
          >
            L{resumeTarget.lessonIndex} of {resumeTarget.totalLessons}
          </span>
        </Link>
      ) : null}
    </main>
  );
}

function StatTile({ value, label }: { value: number | string; label: string }) {
  return (
    <div
      className="lm-card"
      style={{
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      <span
        className="lm-serif lm-tabular"
        style={{ fontSize: 26, lineHeight: 1, color: "var(--text)" }}
      >
        {value}
      </span>
      <span
        className="lm-mono"
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function FeatureRow({
  icon, hue, title, subtitle,
}: {
  icon: React.ReactNode;
  hue: Hue;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start" style={{ gap: 12 }}>
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--r-2)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: `var(--${hue}-deep)`,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", lineHeight: 1.3 }}>
          {title}
        </p>
        <p style={{ marginTop: 2, fontSize: 13, color: "var(--text-3)", lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function CourseRow({
  course, index, bundleLocked, tiers, progress, isCurrent, lang,
}: {
  course: Course;
  index: number;
  bundleLocked: boolean;
  tiers: PlanTier[];
  progress: UserCourseProgress | null;
  isCurrent: boolean;
  lang: string;
}) {
  const courseLocked = bundleLocked || !tierCanAccess(tiers, course.plan_tier);
  const completed = progress?.status === "completed";
  const pct = progress?.progress_pct ?? 0;
  const sub = courseSubtitle(course, lang);
  const tileHue = tileHueForCourse(course, index);
  const hasProgress = !!progress?.started_at && !completed;

  const card = (
    <div
      className="lm-card"
      style={{
        display: "flex",
        gap: 14,
        padding: 14,
        borderColor: isCurrent && !courseLocked ? "var(--indigo)" : "var(--border)",
        borderWidth: isCurrent && !courseLocked ? 2 : 1,
        boxShadow: isCurrent && !courseLocked ? "0 0 0 3px rgba(79, 70, 186, 0.10)" : "none",
        alignItems: "stretch",
      }}
    >
      {/* Tinted icon tile with the course number */}
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          width: 64,
          height: 64,
          borderRadius: "var(--r-3)",
          background: `var(--${tileHue}-soft)`,
          border: `1px solid var(--${tileHue}-deep)`,
          color: `var(--${tileHue}-deep)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {course.emoji ? (
          <span style={{ fontSize: 26 }}>{course.emoji}</span>
        ) : (
          <Sparkles className="h-6 w-6" />
        )}
        <span
          className="lm-mono lm-tabular"
          style={{
            position: "absolute",
            bottom: 4,
            left: 6,
            fontSize: 10,
            fontWeight: 700,
            color: `var(--${tileHue}-deep)`,
            opacity: 0.75,
          }}
        >
          {(index + 1).toString().padStart(2, "0")}
        </span>
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="flex items-start" style={{ gap: 8, justifyContent: "space-between" }}>
          <p
            className="lm-serif"
            style={{ fontSize: 18, lineHeight: 1.2, color: "var(--text)", fontWeight: 600 }}
          >
            {courseTitle(course, lang)}
          </p>
          {isCurrent && !courseLocked ? (
            <span
              style={{
                flexShrink: 0,
                padding: "4px 10px",
                borderRadius: "var(--r-pill)",
                background: "var(--indigo)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Now
            </span>
          ) : courseLocked ? (
            <Lock
              className="h-4 w-4"
              style={{ color: "var(--text-4)", flexShrink: 0, marginTop: 2 }}
            />
          ) : null}
        </div>
        {sub ? (
          <p
            className="lm-serif"
            style={{
              fontSize: 13,
              fontStyle: "italic",
              color: "var(--text-3)",
              lineHeight: 1.35,
            }}
          >
            {sub}
          </p>
        ) : null}
        <div
          className="flex items-center"
          style={{
            marginTop: 4,
            gap: 8,
            fontSize: 12,
            color: "var(--text-3)",
          }}
        >
          <span className="lm-mono lm-tabular">{course.lesson_count}</span>
          <span className="lm-mono">{course.lesson_count === 1 ? "lesson" : "lessons"}</span>
          {course.estimated_minutes > 0 ? (
            <>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span className="lm-mono lm-tabular">{course.estimated_minutes}m</span>
            </>
          ) : null}
          {hasProgress ? (
            <span
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 96,
                  height: 6,
                  borderRadius: "var(--r-pill)",
                  background: "var(--bg-soft)",
                  overflow: "hidden",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--indigo)",
                  }}
                />
              </span>
              <span className="lm-tabular" style={{ fontWeight: 700, color: "var(--text-2)" }}>
                {pct}%
              </span>
            </span>
          ) : completed ? (
            <span
              style={{
                marginLeft: "auto",
                fontWeight: 700,
                color: "var(--moss-deep)",
              }}
            >
              done
            </span>
          ) : !courseLocked && course.lesson_count > 0 ? (
            <span style={{ marginLeft: "auto", color: "var(--text-3)" }}>
              <ArrowRight className="h-4 w-4" style={{ color: "var(--indigo)" }} />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (courseLocked) {
    return <div style={{ opacity: 0.5 }}>{card}</div>;
  }
  return (
    <Link
      href={`/learn/${course.slug}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {card}
    </Link>
  );
}
