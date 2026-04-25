import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { getAllCourses, getMe } from "@/lib/supabase/queries";
import type { Course, PlanTier } from "@/lib/types";
import { formatTier } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Hue = "indigo" | "saffron" | "moss" | "coral" | "ocean" | "plum";

const CATEGORY_ORDER: { key: string; label: string; number: string; hue: Hue }[] = [
  { key: "foundations",  label: "Foundations",   number: "01", hue: "indigo"  },
  { key: "tools",        label: "Tools",         number: "02", hue: "ocean"   },
  { key: "creative",     label: "Creative",      number: "03", hue: "plum"    },
  { key: "productivity", label: "Productivity",  number: "04", hue: "moss"    },
  { key: "real_life",    label: "Real life",     number: "05", hue: "saffron" },
  { key: "exam_prep",    label: "Exams",         number: "06", hue: "coral"   },
];

function tierCanAccess(user: PlanTier, course: PlanTier): boolean {
  const rank: Record<PlanTier, number> = { free: 0, basic: 1, advanced: 2 };
  return rank[user] >= rank[course];
}

export default async function LearnPage() {
  const { user, planId } = await getMe();
  if (!user) redirect("/login");

  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const courses = await getAllCourses();

  const grouped = new Map<string, Course[]>();
  courses.forEach((c) => {
    const key = c.category ?? "other";
    const arr = grouped.get(key) ?? [];
    arr.push(c);
    grouped.set(key, arr);
  });

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
            Short, deliberate courses. Add them one at a time.
          </p>
        </header>

        {CATEGORY_ORDER.map((cat) => {
          const items = grouped.get(cat.key);
          if (!items || items.length === 0) return null;
          return (
            <section key={cat.key} style={{ marginTop: 40 }}>
              <p className="lm-eyebrow">
                <span className="lm-tabular" style={{ marginRight: 8 }}>{cat.number}</span>
                {cat.label}
              </p>
              <div
                className="grid"
                style={{
                  marginTop: 12,
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                }}
              >
                {items.map((c) => (
                  <CourseCardLumen
                    key={c.id}
                    course={c}
                    hue={cat.hue}
                    locked={!tierCanAccess(tier, c.plan_tier)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function CourseCardLumen({
  course, hue, locked,
}: {
  course: Course;
  hue: Hue;
  locked: boolean;
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
          {course.title}
        </h3>
        {course.subtitle ? (
          <p
            style={{
              marginTop: 4,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-3)",
            }}
          >
            {course.subtitle}
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
