import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { getAllBundles, getAllCourses, getMe } from "@/lib/supabase/queries";
import { bundleDescription, bundleTitle, courseSubtitle, courseTitle } from "@/lib/types";
import type { Bundle, Course, PlanTier } from "@/lib/types";
import { formatTier } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Hue = "indigo" | "saffron" | "moss" | "coral" | "ocean" | "plum";

function tierCanAccess(user: PlanTier, target: PlanTier): boolean {
  const rank: Record<PlanTier, number> = { free: 0, basic: 1, advanced: 2 };
  return rank[user] >= rank[target];
}

function hueForGradient(g: string | null | undefined): Hue {
  switch (g) {
    case "ember": return "saffron";
    case "moss":  return "moss";
    case "plum":  return "plum";
    case "paper": return "indigo";
    default:      return "indigo";
  }
}

export default async function LearnPage() {
  const { user, profile, planId } = await getMe();
  if (!user) redirect("/login");

  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const lang = profile?.preferred_language ?? "en";

  const [courses, bundles] = await Promise.all([getAllCourses(), getAllBundles()]);

  const freeCourses = courses.filter((c) => c.plan_tier === "free");
  const basicBundles    = bundles.filter((b) => b.plan_tier === "basic");
  const advancedBundles = bundles.filter((b) => b.plan_tier === "advanced");

  return (
    <main className="lm-page" style={{ paddingBottom: 56 }}>
      <div className="mx-auto" style={{ maxWidth: 768, padding: "32px 20px 0" }}>
        <header>
          <p className="lm-eyebrow">explore</p>
          <h1
            className="lm-serif"
            style={{ marginTop: 8, fontSize: 40, lineHeight: 1.05, color: "var(--text)" }}
          >
            A growing <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>shelf</em>.
          </h1>
          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--text-2)",
            }}
          >
            Three sections — pick where you are, and start small.
          </p>
        </header>

        <CoursesSection
          number="01"
          title="Free"
          subtitle="Eight starter courses. No card, no pressure."
          courses={freeCourses}
          tier={tier}
          lang={lang}
        />

        <BundlesSection
          number="02"
          title="Basic"
          subtitle={`${basicBundles.length} bundles — daily-use AI tools and life utilities.`}
          bundles={basicBundles}
          tier={tier}
          lang={lang}
        />

        <BundlesSection
          number="03"
          title="Advanced"
          subtitle={`${advancedBundles.length} mastery bundles — depth, not breadth.`}
          bundles={advancedBundles}
          tier={tier}
          lang={lang}
        />
      </div>
    </main>
  );
}

function CoursesSection({
  number, title, subtitle, courses, tier, lang,
}: {
  number: string;
  title: string;
  subtitle?: string;
  courses: Course[];
  tier: PlanTier;
  lang: string;
}) {
  if (courses.length === 0) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <p className="lm-eyebrow">
        <span className="lm-tabular" style={{ marginRight: 8 }}>{number}</span>
        {title}
      </p>
      {subtitle ? (
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>{subtitle}</p>
      ) : null}
      <div
        className="grid"
        style={{
          marginTop: 12,
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {courses.map((c) => (
          <CourseCardLumen
            key={c.id}
            course={c}
            hue="indigo"
            locked={!tierCanAccess(tier, c.plan_tier)}
            lang={lang}
          />
        ))}
      </div>
    </section>
  );
}

function BundlesSection({
  number, title, subtitle, bundles, tier, lang,
}: {
  number: string;
  title: string;
  subtitle?: string;
  bundles: Bundle[];
  tier: PlanTier;
  lang: string;
}) {
  if (bundles.length === 0) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <p className="lm-eyebrow">
        <span className="lm-tabular" style={{ marginRight: 8 }}>{number}</span>
        {title}
      </p>
      {subtitle ? (
        <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>{subtitle}</p>
      ) : null}
      <div
        className="grid"
        style={{
          marginTop: 12,
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}
      >
        {bundles.map((b) => (
          <BundleCardLumen
            key={b.id}
            bundle={b}
            locked={!tierCanAccess(tier, b.plan_tier)}
            lang={lang}
          />
        ))}
      </div>
    </section>
  );
}

function CourseCardLumen({
  course, hue, locked, lang,
}: {
  course: Course;
  hue: Hue;
  locked: boolean;
  lang: string;
}) {
  const body = (
    <div
      className="lm-card"
      style={{
        position: "relative",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          background: `var(--${hue}-soft)`,
          color: `var(--${hue}-deep)`,
          borderBottom: "1px solid var(--border)",
        }}
        aria-hidden
      >
        {course.emoji ?? "·"}
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="lm-eyebrow">{formatTier(course.plan_tier)}</span>
          {course.is_bonus_badge ? (
            <span className="lm-eyebrow" style={{ color: `var(--${hue}-deep)` }}>
              bonus
            </span>
          ) : null}
        </div>
        <h3
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 20, lineHeight: 1.2, color: "var(--text)" }}
        >
          {courseTitle(course, lang)}
        </h3>
        {courseSubtitle(course, lang) ? (
          <p
            style={{
              marginTop: 4,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-3)",
            }}
          >
            {courseSubtitle(course, lang)}
          </p>
        ) : null}

        <div
          className="flex items-center"
          style={{ gap: 10, marginTop: 12, fontSize: 12, color: "var(--text-3)" }}
        >
          <span className="inline-flex items-center" style={{ gap: 4 }}>
            <Clock className="h-3.5 w-3.5" />
            <span className="lm-tabular">{course.estimated_minutes}</span> min
          </span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span style={{ textTransform: "capitalize" }}>{course.difficulty}</span>
        </div>
      </div>

      {locked ? (
        <div
          className="inline-flex items-center justify-center"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: "var(--r-2)",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(4px)",
            border: "1px solid var(--border)",
            color: "var(--text-3)",
          }}
        >
          <Lock className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </div>
  );

  if (locked) return <div style={{ opacity: 0.55 }}>{body}</div>;
  return (
    <Link
      href={`/learn/${course.slug}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {body}
    </Link>
  );
}

function BundleCardLumen({
  bundle, locked, lang,
}: {
  bundle: Bundle;
  locked: boolean;
  lang: string;
}) {
  const hue = hueForGradient(bundle.cover_gradient);
  const title = bundleTitle(bundle, lang);
  const desc  = bundleDescription(bundle, lang);

  const body = (
    <div
      className="lm-card"
      style={{
        position: "relative",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 96,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          background: `var(--${hue}-soft)`,
          color: `var(--${hue}-deep)`,
          borderBottom: "1px solid var(--border)",
        }}
        aria-hidden
      >
        {bundle.emoji ?? "·"}
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <span className="lm-eyebrow">{formatTier(bundle.plan_tier)}</span>
          {bundle.tags.includes("utility") ? (
            <span className="lm-eyebrow" style={{ color: `var(--${hue}-deep)` }}>
              utility
            </span>
          ) : null}
        </div>
        <h3
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 20, lineHeight: 1.2, color: "var(--text)" }}
        >
          {title}
        </h3>
        {desc ? (
          <p
            style={{
              marginTop: 4,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-3)",
            }}
          >
            {desc}
          </p>
        ) : null}
      </div>

      {locked ? (
        <div
          className="inline-flex items-center justify-center"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            width: 28,
            height: 28,
            borderRadius: "var(--r-2)",
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(4px)",
            border: "1px solid var(--border)",
            color: "var(--text-3)",
          }}
        >
          <Lock className="h-3.5 w-3.5" />
        </div>
      ) : null}
    </div>
  );

  if (locked) return <div style={{ opacity: 0.55 }}>{body}</div>;
  return (
    <Link
      href={`/learn/bundles/${bundle.slug}`}
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      {body}
    </Link>
  );
}
