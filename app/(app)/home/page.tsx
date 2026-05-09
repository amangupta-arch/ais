import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Compass, Flame, Lock, Star, Check } from "lucide-react";

import {
  getAllBundles, getAllCourses, getMe, getMyCourseProgress,
} from "@/lib/supabase/queries";
import { firstName } from "@/lib/utils";
import { bundleDescription, bundleTitle, courseTitle, pickLanguageVariants } from "@/lib/types";
import type { Bundle, Course, PlanTier, Persona } from "@/lib/types";

export const dynamic = "force-dynamic";

type Hue = "indigo" | "saffron" | "moss" | "coral" | "ocean" | "plum";

function tierCanAccess(userTier: PlanTier, courseTier: PlanTier): boolean {
  const rank: Record<PlanTier, number> = { free: 0, basic: 1, advanced: 2 };
  return rank[userTier] >= rank[courseTier];
}

function hueForCategory(cat: string | null | undefined): Hue {
  switch (cat) {
    case "foundations":  return "indigo";
    case "tools":        return "ocean";
    case "creative":     return "plum";
    case "productivity": return "moss";
    case "real_life":    return "saffron";
    case "exam_prep":    return "coral";
    default:             return "indigo";
  }
}

export default async function HomePage() {
  const { user, profile, streak, xp, planId } = await getMe();
  if (!user) redirect("/login");
  if (profile && !profile.onboarding_completed_at) redirect("/onboarding");

  const [courses, bundles, progress] = await Promise.all([
    getAllCourses(),
    getAllBundles(),
    getMyCourseProgress(),
  ]);
  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const lang = profile?.preferred_language ?? "en";
  const nowHour = new Date().getHours();
  const greeting = nowHour < 12 ? "Good morning" : nowHour < 18 ? "Good afternoon" : "Good evening";

  const inProgress = progress
    .filter((p) => p.status === "in_progress")
    .map((p) => courses.find((c) => c.id === p.course_id))
    .filter((c): c is Course => !!c);

  const completedCount = progress.filter((p) => p.status === "completed").length;
  const progressByCourse = new Map(progress.map((p) => [p.course_id, p]));

  // Free section: courses (free has no bundles).
  // Basic / Advanced sections: bundles, scoped to the user's preferred language with EN fallback.
  const dedupedCourses  = pickLanguageVariants(courses, lang);
  const freeCourses     = dedupedCourses.filter((c) => c.plan_tier === "free");
  const basicBundles    = bundles.filter((b) => b.plan_tier === "basic").slice(0, 12);
  const advancedBundles = bundles.filter((b) => b.plan_tier === "advanced").slice(0, 12);

  // "Today's lesson" hero: resolve the canonical chatgpt-basics group, then
  // pick the variant in the user's language (or EN fallback).
  const cgptGroupId = courses.find((c) => c.slug === "chatgpt-basics")?.course_group_id;
  const cgptForUser = cgptGroupId
    ? dedupedCourses.find((c) => c.course_group_id === cgptGroupId)
    : courses.find((c) => c.slug === "chatgpt-basics");

  const todaysLessonCourse = inProgress[0] ?? cgptForUser ?? dedupedCourses[0];

  const personaId = (profile?.preferred_tutor_persona as Persona["id"]) ?? "nova";

  return (
    <main className="lm-page">
      <div className="mx-auto" style={{ maxWidth: 640, padding: "24px 20px 40px" }}>
        <header
          className="flex items-start justify-between"
          style={{ gap: 16 }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="lm-eyebrow">
              {new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()}
            </p>
            <h1
              className="lm-serif"
              style={{
                marginTop: 4,
                fontSize: 28,
                lineHeight: 1.15,
                color: "var(--text)",
              }}
            >
              {greeting},{" "}
              <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>
                {firstName(profile?.display_name ?? user.email ?? "")}
              </em>
              .
            </h1>
          </div>
          <NovaAvatar personaId={personaId} />
        </header>

        <section
          className="grid"
          style={{ gap: 8, marginTop: 20, gridTemplateColumns: "repeat(3, 1fr)" }}
        >
          <StatTile
            hue="saffron"
            icon={<Flame className="h-4 w-4" />}
            value={streak?.current_streak ?? 0}
            label="day streak"
          />
          <StatTile
            hue="indigo"
            icon={<Star className="h-4 w-4" />}
            value={xp?.total_xp ?? 0}
            label="total XP"
          />
          <StatTile
            hue="moss"
            icon={<Check className="h-4 w-4" />}
            value={completedCount}
            label="lessons"
          />
        </section>

        {todaysLessonCourse ? (
          <section style={{ marginTop: 32 }}>
            <p className="lm-eyebrow">
              <span className="lm-tabular" style={{ marginRight: 8 }}>today</span>
              a small move
            </p>
            <Link
              href={`/learn/${todaysLessonCourse.slug}`}
              style={{
                display: "block",
                marginTop: 12,
                padding: 24,
                borderRadius: "var(--r-4)",
                background:
                  "linear-gradient(135deg, var(--indigo) 0%, var(--plum) 100%)",
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
                continue
              </p>
              <p
                className="lm-serif"
                style={{ marginTop: 8, fontSize: 24, lineHeight: 1.2 }}
              >
                {todaysLessonCourse.subtitle ?? todaysLessonCourse.title}
              </p>
              <div
                className="flex items-center justify-between"
                style={{ marginTop: 16 }}
              >
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  <span className="lm-tabular">{profile?.daily_goal_minutes ?? 10}</span>{" "}
                  min · {todaysLessonCourse.title}
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
          </section>
        ) : null}

        {inProgress.length > 0 ? (
          <CourseRow
            number="01"
            title="Continue"
            courses={inProgress}
            tier={tier}
            progressByCourse={progressByCourse}
            lang={lang}
          />
        ) : null}

        <CourseRow
          number="02"
          title="Free"
          courses={freeCourses}
          tier={tier}
          progressByCourse={progressByCourse}
          lang={lang}
        />
        <BundleRow
          number="03"
          title="Basic"
          bundles={basicBundles}
          tier={tier}
          lang={lang}
        />
        <BundleRow
          number="04"
          title="Advanced"
          bundles={advancedBundles}
          tier={tier}
          lang={lang}
        />

        <div className="flex justify-center" style={{ marginTop: 40 }}>
          <Link href="/learn" className="lm-btn lm-btn--ghost lm-btn--sm">
            <Compass className="h-4 w-4" /> See everything
          </Link>
        </div>
      </div>
    </main>
  );
}

function StatTile({
  hue, icon, value, label,
}: {
  hue: Hue;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className={`lm-stat lm-stat--${hue === "saffron" || hue === "indigo" || hue === "moss" ? hue : "indigo"}`}>
      {icon}
      <div className="lm-stat__value lm-tabular">{value}</div>
      <div className="lm-stat__label">{label}</div>
    </div>
  );
}

function NovaAvatar({ personaId }: { personaId: Persona["id"] }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-avatars/${personaId}.png`
    : null;
  return (
    <span className="lm-avatar lm-avatar--md" aria-label="Your tutor">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span aria-hidden>{personaId.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

function CourseRow({
  number, title, courses, tier, progressByCourse, lang,
}: {
  number: string;
  title: string;
  courses: Course[];
  tier: PlanTier;
  progressByCourse: Map<string, { progress_pct: number }>;
  lang: string;
}) {
  if (courses.length === 0) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <div className="flex items-baseline justify-between">
        <p className="lm-eyebrow">
          <span className="lm-tabular" style={{ marginRight: 8 }}>{number}</span>
          {title}
        </p>
        <Link
          href="/learn"
          className="lm-mono"
          style={{ fontSize: 11, color: "var(--text-3)", textDecoration: "none" }}
        >
          more →
        </Link>
      </div>
      <div
        className="no-scrollbar"
        style={{
          marginTop: 12,
          marginLeft: -20,
          marginRight: -20,
          padding: "0 20px",
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
        }}
      >
        {courses.map((c) => {
          const locked = !tierCanAccess(tier, c.plan_tier);
          const pct = progressByCourse.get(c.id)?.progress_pct;
          const hue = hueForCategory(c.category);
          return (
            <div
              key={c.id}
              style={{ width: "68%", flexShrink: 0, scrollSnapAlign: "start", maxWidth: 280 }}
            >
              <HomeCourseCard course={c} hue={hue} locked={locked} progressPct={pct} lang={lang} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BundleRow({
  number, title, bundles, tier, lang,
}: {
  number: string;
  title: string;
  bundles: Bundle[];
  tier: PlanTier;
  lang: string;
}) {
  if (bundles.length === 0) return null;
  return (
    <section style={{ marginTop: 32 }}>
      <div className="flex items-baseline justify-between">
        <p className="lm-eyebrow">
          <span className="lm-tabular" style={{ marginRight: 8 }}>{number}</span>
          {title}
        </p>
        <Link
          href="/learn"
          className="lm-mono"
          style={{ fontSize: 11, color: "var(--text-3)", textDecoration: "none" }}
        >
          more →
        </Link>
      </div>
      <div
        className="no-scrollbar"
        style={{
          marginTop: 12,
          marginLeft: -20,
          marginRight: -20,
          padding: "0 20px",
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
        }}
      >
        {bundles.map((b) => {
          const locked = !tierCanAccess(tier, b.plan_tier);
          return (
            <div
              key={b.id}
              style={{ width: "68%", flexShrink: 0, scrollSnapAlign: "start", maxWidth: 280 }}
            >
              <HomeBundleCard bundle={b} locked={locked} lang={lang} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HomeBundleCard({
  bundle, locked, lang,
}: {
  bundle: Bundle;
  locked: boolean;
  lang: string;
}) {
  const hue: Hue =
    bundle.cover_gradient === "ember"  ? "saffron" :
    bundle.cover_gradient === "moss"   ? "moss"    :
    bundle.cover_gradient === "plum"   ? "plum"    :
    "indigo";
  const title = bundleTitle(bundle, lang);
  const desc  = bundleDescription(bundle, lang);

  return (
    <div
      className="lm-card"
      style={{ position: "relative", padding: 0, overflow: "hidden", opacity: locked ? 0.55 : 1 }}
    >
      <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          background: `var(--${hue}-soft)`,
          color: `var(--${hue}-deep)`,
          borderBottom: "1px solid var(--border)",
        }}
        aria-hidden
      >
        {bundle.emoji ?? "·"}
      </div>
      <div style={{ padding: 14 }}>
        <h3
          className="lm-serif"
          style={{ fontSize: 16, lineHeight: 1.25, color: "var(--text)" }}
        >
          {title}
        </h3>
        {desc ? (
          <p
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "var(--text-3)",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {desc}
          </p>
        ) : null}
        <div
          className="flex items-center"
          style={{ gap: 8, marginTop: 10, fontSize: 11, color: "var(--text-3)" }}
        >
          {locked ? (
            <>
              <Lock className="h-3 w-3" />
              <span style={{ textTransform: "capitalize" }}>{bundle.plan_tier}</span>
              <span>plan</span>
            </>
          ) : (
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Bundle
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeCourseCard({
  course, hue, locked, progressPct, lang,
}: {
  course: Course;
  hue: Hue;
  locked: boolean;
  progressPct?: number;
  lang: string;
}) {
  const body = (
    <div
      className="lm-card"
      style={{ position: "relative", padding: 0, overflow: "hidden" }}
    >
      <div
        style={{
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          background: `var(--${hue}-soft)`,
          color: `var(--${hue}-deep)`,
          borderBottom: "1px solid var(--border)",
        }}
        aria-hidden
      >
        {course.emoji ?? "·"}
      </div>
      <div style={{ padding: 14 }}>
        <h3
          className="lm-serif"
          style={{ fontSize: 16, lineHeight: 1.25, color: "var(--text)" }}
        >
          {courseTitle(course, lang)}
        </h3>
        <div
          className="flex items-center"
          style={{ gap: 8, marginTop: 8, fontSize: 11, color: "var(--text-3)" }}
        >
          <span className="lm-tabular">{course.estimated_minutes}</span>
          <span>min</span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ textTransform: "capitalize" }}>{course.difficulty}</span>
        </div>
        {typeof progressPct === "number" && progressPct > 0 ? (
          <div className="lm-progress" style={{ marginTop: 10, height: 4 }}>
            <div
              className="lm-progress__fill"
              style={{
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
  if (locked) return <div style={{ opacity: 0.5 }}>{body}</div>;
  return (
    <Link
      href={`/learn/${course.slug}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {body}
    </Link>
  );
}
