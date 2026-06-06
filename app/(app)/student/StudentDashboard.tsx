// Post-login dashboard body. Composed of five stacked sections:
//
//   1. Greeting + persona avatar
//   2. Hero — "Continue" if any in-progress lesson exists, else
//      "Today's lesson" pointing at a sensible default course
//   3. Stat tiles — streak / XP / lessons completed
//   4. Weekly streak strip — Mon-Sun dots, today highlighted
//   5. Up next — small rail of the next un-completed lesson per
//      in-progress course
//   6. Your curriculum — subject grid (existing /student logic)
//
// Pure presentational; the parent page does all the data fetching.

import Link from "next/link";
import { ArrowRight, Check, Flame, Star } from "lucide-react";

import { courseSubtitle, courseTitle, bundleDescription, bundleTitle } from "@/lib/types";
import type { Course } from "@/lib/types";
import type { StudentSubject, UpNextLesson } from "@/lib/supabase/queries";

import { findSchoolPath } from "./paths";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StudentDashboard({
  firstName,
  schoolClass,
  institute,
  lang,
  streakDays,
  totalXp,
  completedLessons,
  weekly,
  upNext,
  subjects,
  allCourses,
}: {
  firstName: string;
  schoolClass: string;
  institute: string | null;
  lang: string;
  streakDays: number;
  totalXp: number;
  completedLessons: number;
  weekly: boolean[];
  upNext: UpNextLesson[];
  subjects: StudentSubject[];
  allCourses: Course[];
}) {
  const path = findSchoolPath(institute, schoolClass);
  const cohortLabel = path
    ? path.subtitle
      ? `${path.subtitle} · ${path.label}`
      : path.label
    : `Class ${schoolClass}`;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayIdx = (new Date().getUTCDay() + 6) % 7;

  // Hero: the first "Up next" lesson if we have one (resume); else
  // the first free course as today's lesson.
  const heroResume = upNext[0] ?? null;
  const fallbackCourse =
    allCourses.find((c) => c.slug === "chatgpt-basics") ??
    allCourses.find((c) => c.plan_tier === "free") ??
    allCourses[0] ??
    null;

  return (
    <main className="lm-page">
      <div className="mx-auto" style={{ maxWidth: 720, padding: "24px 20px 64px" }}>
        {/* 1 · Greeting ─────────────────────────────────────────── */}
        <header
          className="flex items-start justify-between"
          style={{ gap: 16 }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="lm-eyebrow">{cohortLabel}</p>
            <h1
              className="lm-serif"
              style={{ marginTop: 4, fontSize: 28, lineHeight: 1.15, color: "var(--text)" }}
            >
              {greeting},{" "}
              <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>
                {firstNameOnly(firstName)}
              </em>
              .
            </h1>
          </div>
        </header>

        {/* 2 · Hero ────────────────────────────────────────────── */}
        {heroResume ? (
          <ResumeHero item={heroResume} lang={lang} />
        ) : fallbackCourse ? (
          <FallbackHero course={fallbackCourse} lang={lang} />
        ) : null}

        {/* 3 · Stat tiles ──────────────────────────────────────── */}
        <section
          className="grid"
          style={{ gap: 8, marginTop: 24, gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          <StatTile
            hue="saffron"
            icon={<Flame className="h-4 w-4" />}
            value={streakDays}
            label="day streak"
          />
          <StatTile
            hue="indigo"
            icon={<Star className="h-4 w-4" />}
            value={totalXp}
            label="total XP"
          />
          <StatTile
            hue="moss"
            icon={<Check className="h-4 w-4" />}
            value={completedLessons}
            label="lessons"
          />
        </section>

        {/* 4 · Weekly strip ────────────────────────────────────── */}
        <section style={{ marginTop: 24 }}>
          <p className="lm-eyebrow">this week</p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
              marginTop: 10,
            }}
          >
            {DAY_LABELS.map((label, i) => {
              const active = weekly[i];
              const isToday = i === todayIdx;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    className="lm-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      color: isToday ? "var(--indigo)" : "var(--text-3)",
                      fontWeight: isToday ? 700 : 500,
                    }}
                  >
                    {label}
                  </span>
                  <span
                    aria-label={
                      active
                        ? `${label}: active`
                        : isToday
                        ? `${label}: today, no activity yet`
                        : `${label}: no activity`
                    }
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: active
                        ? "var(--saffron)"
                        : isToday
                        ? "var(--paper-pure)"
                        : "var(--bg-soft)",
                      border: isToday && !active ? "2px dashed var(--indigo)" : "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: active ? "#fff" : "var(--text-3)",
                    }}
                  >
                    {active && <Check className="h-3 w-3" />}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5 · Up next ─────────────────────────────────────────── */}
        {upNext.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <p className="lm-eyebrow">up next</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {upNext.map((item) => (
                <UpNextCard key={item.lesson.id} item={item} lang={lang} />
              ))}
            </div>
          </section>
        )}

        {/* 6 · Curriculum subjects ─────────────────────────────── */}
        <section style={{ marginTop: 32 }}>
          <div className="flex items-baseline justify-between">
            <p className="lm-eyebrow">your curriculum</p>
            <Link
              href="/profile"
              className="lm-mono"
              style={{ fontSize: 11, color: "var(--text-3)", textDecoration: "none" }}
            >
              change class →
            </Link>
          </div>
          {subjects.length === 0 ? (
            <EmptyState schoolClass={schoolClass} />
          ) : (
            subjects.map((subject) => (
              <SubjectBlock key={subject.key} subject={subject} lang={lang} />
            ))
          )}
        </section>

        <div className="flex justify-center" style={{ marginTop: 40 }}>
          <Link href="/learn" className="lm-btn lm-btn--ghost lm-btn--sm">
            Browse the full library
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ─── sections ─────────────────────────────────────────────────── */

function ResumeHero({ item, lang }: { item: UpNextLesson; lang: string }) {
  const cTitle = courseTitle(item.course, lang);
  const lTitle = courseSubtitle(item.course, lang) ?? cTitle;
  const continueLabel = item.lessonStatus === "in_progress" ? "Continue" : "Pick up";
  return (
    <Link
      href={`/learn/${item.course.slug}/${item.lesson.slug}`}
      style={{
        display: "block",
        marginTop: 20,
        padding: 24,
        borderRadius: "var(--r-4)",
        background: "linear-gradient(135deg, var(--indigo) 0%, var(--plum) 100%)",
        color: "#fff",
        textDecoration: "none",
        boxShadow: "var(--shadow-2)",
      }}
    >
      <p
        className="lm-mono"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.78,
        }}
      >
        {continueLabel.toLowerCase()}
      </p>
      <p className="lm-serif" style={{ marginTop: 8, fontSize: 24, lineHeight: 1.2 }}>
        {lTitle}
      </p>
      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          {item.course.estimated_minutes != null && (
            <>
              <span className="lm-tabular">{item.course.estimated_minutes}</span> min ·{" "}
            </>
          )}
          {cTitle}
        </span>
        <div
          className="inline-flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#fff",
            color: "var(--indigo-deep)",
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function FallbackHero({ course, lang }: { course: Course; lang: string }) {
  return (
    <Link
      href={`/learn/${course.slug}`}
      style={{
        display: "block",
        marginTop: 20,
        padding: 24,
        borderRadius: "var(--r-4)",
        background: "linear-gradient(135deg, var(--indigo) 0%, var(--plum) 100%)",
        color: "#fff",
        textDecoration: "none",
        boxShadow: "var(--shadow-2)",
      }}
    >
      <p
        className="lm-mono"
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.78,
        }}
      >
        today
      </p>
      <p className="lm-serif" style={{ marginTop: 8, fontSize: 24, lineHeight: 1.2 }}>
        {courseSubtitle(course, lang) ?? courseTitle(course, lang)}
      </p>
      <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
        <span style={{ fontSize: 12, opacity: 0.85 }}>
          <span className="lm-tabular">{course.estimated_minutes ?? 10}</span> min ·{" "}
          {courseTitle(course, lang)}
        </span>
        <div
          className="inline-flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "#fff",
            color: "var(--indigo-deep)",
          }}
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function UpNextCard({ item, lang }: { item: UpNextLesson; lang: string }) {
  return (
    <Link
      href={`/learn/${item.course.slug}/${item.lesson.slug}`}
      className="lm-card"
      style={{
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-soft)",
          borderRadius: "var(--r-3)",
          fontSize: 20,
        }}
        aria-hidden
      >
        {item.course.emoji ?? "·"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: "0.04em" }}>
          {courseTitle(item.course, lang)}
        </div>
        <div
          className="lm-serif"
          style={{
            marginTop: 2,
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.25,
            color: "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {lessonLabel(item, lang)}
        </div>
      </div>
      <ArrowRight className="h-4 w-4" style={{ color: "var(--text-3)" }} />
    </Link>
  );
}

function SubjectBlock({ subject, lang }: { subject: StudentSubject; lang: string }) {
  return (
    <div style={{ marginTop: 20 }}>
      <h2
        className="lm-serif"
        style={{
          fontSize: 18,
          lineHeight: 1.2,
          fontWeight: 500,
          margin: "0 0 10px",
          color: "var(--text)",
        }}
      >
        {subject.label}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {subject.bundles.map((b) => (
          <Link
            key={b.id}
            href={`/learn/bundles/${b.slug}`}
            className="lm-card"
            style={{
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {b.emoji && (
              <div
                style={{
                  fontSize: 24,
                  flexShrink: 0,
                  width: 44,
                  height: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-soft)",
                  borderRadius: "var(--r-3)",
                }}
              >
                {b.emoji}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="lm-serif"
                style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25, marginBottom: 2 }}
              >
                {bundleTitle(b, lang)}
              </div>
              {bundleDescription(b, lang) && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-3)",
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {bundleDescription(b, lang)}
                </div>
              )}
            </div>
            <ArrowRight className="h-4 w-4" style={{ color: "var(--text-3)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ schoolClass }: { schoolClass: string }) {
  return (
    <div
      className="lm-card"
      style={{ padding: 28, textAlign: "center", background: "var(--bg-soft)", marginTop: 16 }}
    >
      <div className="lm-eyebrow" style={{ marginBottom: 6 }}>
        Coming soon
      </div>
      <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
        We&rsquo;re still building Class {schoolClass} chapters. Check back soon — or pick a
        different class from your profile.
      </p>
    </div>
  );
}

function StatTile({
  hue,
  icon,
  value,
  label,
}: {
  hue: "saffron" | "indigo" | "moss";
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className={`lm-stat lm-stat--${hue}`}>
      {icon}
      <div className="lm-stat__value lm-tabular">{value}</div>
      <div className="lm-stat__label">{label}</div>
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────────────── */

function firstNameOnly(s: string): string {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return "there";
  if (trimmed.includes("@")) return trimmed.split("@")[0]!;
  return trimmed.split(/\s+/)[0]!;
}

function lessonLabel(item: UpNextLesson, lang: string): string {
  // Lesson has its own translations table; fall back to slug.
  const ll = item.lesson as unknown as {
    translations?: Record<string, { title?: string }>;
    slug: string;
  };
  return (
    ll.translations?.[lang]?.title ??
    ll.translations?.en?.title ??
    ll.slug
  );
}
