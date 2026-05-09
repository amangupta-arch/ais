import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";

import { getCourseBySlug, getMe, getMyLessonProgress } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/types";
import { courseTitle, courseSubtitle, courseDescription, lessonTitle, lessonSubtitle } from "@/lib/types";
import { formatTier } from "@/lib/utils";

export const dynamic = "force-dynamic";

function tierCanAccess(user: PlanTier, course: PlanTier): boolean {
  const rank: Record<PlanTier, number> = { free: 0, basic: 1, advanced: 2 };
  return rank[user] >= rank[course];
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const { user, profile, planId } = await getMe();
  if (!user) redirect("/login");

  const { course, lessons } = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  // If the user prefers a different language and a sibling variant exists in
  // that language, redirect there. Direct URL hits to the EN slug should land
  // a Hinglish-preferring user on the Hinglish variant.
  const preferredLang = profile?.preferred_language ?? "en";
  if (course.course_group_id && course.language_code !== preferredLang) {
    const supabase = await createClient();
    const { data: sibling } = await supabase
      .from("courses")
      .select("slug")
      .eq("course_group_id", course.course_group_id)
      .eq("language_code", preferredLang)
      .eq("is_published", true)
      .maybeSingle();
    if (sibling?.slug && sibling.slug !== course.slug) {
      redirect(`/learn/${sibling.slug}`);
    }
  }

  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const locked = !tierCanAccess(tier, course.plan_tier);
  const progress = await getMyLessonProgress(course.id);
  const progByLesson = new Map(progress.map((p) => [p.lesson_id, p]));

  return (
    <main className="lm-page" style={{ paddingBottom: 56 }}>
      <div className="mx-auto" style={{ maxWidth: 640, padding: "24px 20px 0" }}>
        <Link
          href="/learn"
          className="lm-mono"
          style={{ fontSize: 13, color: "var(--text-3)", textDecoration: "none" }}
        >
          ← back to shelf
        </Link>

        <header style={{ marginTop: 24 }}>
          <p className="lm-eyebrow">
            {formatTier(course.plan_tier)}
            {course.is_bonus_badge ? " · bonus" : ""}
          </p>
          <h1
            className="lm-serif"
            style={{ marginTop: 8, fontSize: 40, lineHeight: 1.05, color: "var(--text)" }}
          >
            {courseTitle(course, preferredLang)}
          </h1>
          {courseSubtitle(course, preferredLang) ? (
            <p
              className="lm-serif"
              style={{
                marginTop: 8,
                fontSize: 18,
                fontStyle: "italic",
                lineHeight: 1.4,
                color: "var(--text-2)",
              }}
            >
              {courseSubtitle(course, preferredLang)}
            </p>
          ) : null}
          {courseDescription(course, preferredLang) ? (
            <p
              style={{
                marginTop: 16,
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--text-2)",
              }}
            >
              {courseDescription(course, preferredLang)}
            </p>
          ) : null}

          <div
            className="flex items-center"
            style={{ gap: 12, marginTop: 20, fontSize: 13, color: "var(--text-3)" }}
          >
            <span className="inline-flex items-center" style={{ gap: 4 }}>
              <Clock className="h-4 w-4" />
              <span className="lm-tabular">{course.estimated_minutes}</span> min
            </span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span style={{ textTransform: "capitalize" }}>{course.difficulty}</span>
            <span style={{ color: "var(--border-strong)" }}>·</span>
            <span>
              <span className="lm-tabular">{course.lesson_count}</span> lessons
            </span>
          </div>
        </header>

        {locked ? (
          <section className="lm-card" style={{ marginTop: 32, padding: 24 }}>
            <p className="lm-eyebrow">locked</p>
            <p
              className="lm-serif"
              style={{ marginTop: 8, fontSize: 22, lineHeight: 1.25, color: "var(--text)" }}
            >
              This course is on the {formatTier(course.plan_tier)} plan.
            </p>
            <p
              style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55, color: "var(--text-2)" }}
            >
              Plans open in Phase 2. For now, the starters are yours.
            </p>
            <div style={{ marginTop: 20 }}>
              <Link href="/learn" className="lm-btn lm-btn--secondary lm-btn--sm">
                Browse starters
              </Link>
            </div>
          </section>
        ) : null}

        <section style={{ marginTop: 32 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>lessons</span>
            in order
          </p>
          {lessons.length === 0 ? (
            <p style={{ marginTop: 12, fontSize: 14, color: "var(--text-2)" }}>
              Lessons are being authored. Check back soon.
            </p>
          ) : (
            <ol className="flex flex-col" style={{ gap: 10, marginTop: 12 }}>
              {lessons.map((l, i) => {
                const p = progByLesson.get(l.id);
                const completed = p?.status === "completed";
                const href = `/learn/${course.slug}/${l.slug}`;
                const card = (
                  <div
                    className="lm-card flex items-center"
                    style={{ gap: 16, padding: 16 }}
                  >
                    <span
                      className="lm-mono lm-tabular"
                      style={{
                        width: 32,
                        flexShrink: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: completed ? "var(--moss-deep)" : "var(--text-4)",
                      }}
                    >
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="lm-serif"
                        style={{ fontSize: 18, lineHeight: 1.25, color: "var(--text)" }}
                      >
                        {lessonTitle(l, preferredLang)}
                      </p>
                      {lessonSubtitle(l, preferredLang) ? (
                        <p
                          style={{
                            marginTop: 2,
                            fontSize: 13,
                            color: "var(--text-3)",
                            lineHeight: 1.4,
                          }}
                        >
                          {lessonSubtitle(l, preferredLang)}
                        </p>
                      ) : null}
                      <div
                        className="flex items-center"
                        style={{
                          marginTop: 8,
                          gap: 8,
                          fontSize: 11,
                          color: "var(--text-3)",
                        }}
                      >
                        <span className="lm-tabular">{l.estimated_minutes}</span>
                        <span>min</span>
                        <span style={{ color: "var(--border-strong)" }}>·</span>
                        <span className="lm-tabular">+{l.xp_reward}</span>
                        <span>XP</span>
                        {completed ? (
                          <>
                            <span style={{ color: "var(--border-strong)" }}>·</span>
                            <span style={{ color: "var(--moss-deep)", fontWeight: 600 }}>
                              done
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight
                      className="h-4 w-4"
                      style={{ color: "var(--indigo)", flexShrink: 0 }}
                    />
                  </div>
                );
                return (
                  <li key={l.id}>
                    {locked ? (
                      <div style={{ opacity: 0.45 }}>{card}</div>
                    ) : (
                      <Link
                        href={href}
                        style={{ display: "block", textDecoration: "none", color: "inherit" }}
                      >
                        {card}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
