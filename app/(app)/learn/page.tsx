import { redirect } from "next/navigation";

import { CourseCard } from "@/components/ui/CourseCard";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";

import { getAllCourses, getMe } from "@/lib/supabase/queries";
import type { Course, PlanTier } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: { key: string; label: string; number: string }[] = [
  { key: "foundations",  label: "Foundations",   number: "01" },
  { key: "tools",        label: "Tools",         number: "02" },
  { key: "creative",     label: "Creative",      number: "03" },
  { key: "productivity", label: "Productivity",  number: "04" },
  { key: "real_life",    label: "Real life",     number: "05" },
  { key: "exam_prep",    label: "Exams",         number: "06" },
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
    <main className="mx-auto max-w-3xl px-5 pt-6 pb-10">
      <header>
        <Eyebrow>explore</Eyebrow>
        <Display as="h1" size="lg" className="mt-2">A growing shelf.</Display>
        <p className="mt-3 text-ink-700">Short, deliberate courses. Add them one at a time.</p>
      </header>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped.get(cat.key);
        if (!items || items.length === 0) return null;
        return (
          <section key={cat.key} className="mt-8">
            <Eyebrow number={cat.number}>{cat.label}</Eyebrow>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((c) => (
                <CourseCard key={c.id} course={c} locked={!tierCanAccess(tier, c.plan_tier)} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
