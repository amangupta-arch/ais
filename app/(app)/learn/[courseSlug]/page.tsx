import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Clock } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";

import { getCourseBySlug, getMe, getMyLessonProgress } from "@/lib/supabase/queries";
import type { PlanTier } from "@/lib/types";
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
  const { user, planId } = await getMe();
  if (!user) redirect("/login");

  const { course, lessons } = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const locked = !tierCanAccess(tier, course.plan_tier);
  const progress = await getMyLessonProgress(course.id);
  const progByLesson = new Map(progress.map((p) => [p.lesson_id, p]));

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-10">
      <Link href="/learn" className="text-sm text-ink-500 hover:text-ink-800 transition-colors duration-150 ease-out">← back to shelf</Link>

      <header className="mt-6">
        <Eyebrow>
          {formatTier(course.plan_tier)}
          {course.is_bonus_badge ? " · bonus" : ""}
        </Eyebrow>
        <Display as="h1" size="lg" className="mt-2">{course.title}</Display>
        {course.subtitle ? (
          <p className="mt-2 text-ink-700 text-lg">{course.subtitle}</p>
        ) : null}
        {course.description ? (
          <p className="mt-4 text-ink-700 leading-relaxed">{course.description}</p>
        ) : null}

        <div className="mt-5 flex items-center gap-3 text-sm text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4" /> <span className="font-tabular">{course.estimated_minutes}</span> min
          </span>
          <span className="text-ink-300">·</span>
          <span className="capitalize">{course.difficulty}</span>
          <span className="text-ink-300">·</span>
          <span><span className="font-tabular">{course.lesson_count}</span> lessons</span>
        </div>
      </header>

      {locked ? (
        <section className="mt-8 rounded-lg bg-white border border-ink-200 p-6">
          <Eyebrow>locked</Eyebrow>
          <p className="mt-2 font-semibold text-2xl text-ink-900">
            This course is on the {formatTier(course.plan_tier)} plan.
          </p>
          <p className="mt-2 text-ink-700">Plans open in Phase 2. For now, the starters are yours.</p>
          <div className="mt-5">
            <ButtonLink href="/learn" variant="secondary" size="md">Browse starters</ButtonLink>
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <Eyebrow number="lessons">In order</Eyebrow>
        {lessons.length === 0 ? (
          <p className="mt-3 text-ink-700">Lessons are being authored. Check back soon.</p>
        ) : (
          <ol className="mt-3 flex flex-col gap-2.5">
            {lessons.map((l, i) => {
              const p = progByLesson.get(l.id);
              const completed = p?.status === "completed";
              const href = `/learn/${course.slug}/${l.slug}`;
              const content = (
                <div className="rounded-lg border border-ink-200 bg-white p-4 flex items-center gap-4 transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink-300 hover:shadow-card-hover">
                  <span className="font-mono font-semibold text-ink-400 tabular-nums w-8 shrink-0">
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[16px] text-ink-900">{l.title}</p>
                    {l.subtitle ? <p className="text-sm text-ink-600 mt-[2px]">{l.subtitle}</p> : null}
                    <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                      <span className="font-tabular">{l.estimated_minutes}</span> min
                      <span className="text-ink-300">·</span>
                      <span className="font-tabular">+{l.xp_reward}</span> XP
                      {completed ? <><span className="text-ink-300">·</span><span className="text-success-700">done</span></> : null}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-accent-600 shrink-0" />
                </div>
              );
              return (
                <li key={l.id}>
                  {locked ? <div className="opacity-50">{content}</div> : <Link href={href}>{content}</Link>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
