import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui/Button";
import { CourseCard } from "@/components/ui/CourseCard";
import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { StreakBadge } from "@/components/ui/StreakBadge";
import { XpBadge } from "@/components/ui/XpBadge";
import { TutorAvatar } from "@/components/ui/TutorAvatar";

import {
  getAllCourses, getMe, getMyCourseProgress,
} from "@/lib/supabase/queries";
import { firstName } from "@/lib/utils";
import type { Course, PlanTier } from "@/lib/types";

export const dynamic = "force-dynamic";

function tierCanAccess(userTier: PlanTier, courseTier: PlanTier): boolean {
  const rank: Record<PlanTier, number> = { free: 0, basic: 1, advanced: 2 };
  return rank[userTier] >= rank[courseTier];
}

export default async function HomePage() {
  const { user, profile, streak, xp, planId } = await getMe();
  if (!user) redirect("/login");
  if (profile && !profile.onboarding_completed_at) redirect("/onboarding");

  const [courses, progress] = await Promise.all([getAllCourses(), getMyCourseProgress()]);
  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const nowHour = new Date().getHours();
  const greeting = nowHour < 12 ? "Morning" : nowHour < 18 ? "Afternoon" : "Evening";

  const inProgress = progress
    .filter((p) => p.status === "in_progress")
    .map((p) => courses.find((c) => c.id === p.course_id))
    .filter((c): c is Course => !!c);

  const progressByCourse = new Map(progress.map((p) => [p.course_id, p]));

  const starters = courses.filter((c) => c.plan_tier === "free").slice(0, 6);
  const forYou   = courses.filter((c) => c.plan_tier !== "free" && !c.is_bonus_badge).slice(0, 6);
  const bonus    = courses.filter((c) => c.is_bonus_badge).slice(0, 6);

  const todaysLessonCourse =
    inProgress[0] ?? courses.find((c) => c.slug === "chatgpt-basics") ?? courses[0];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{greeting.toLowerCase()}</p>
          <Display as="h1" size="md" className="mt-1">
            Hello, {firstName(profile?.display_name ?? user.email)}.
          </Display>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StreakBadge days={streak?.current_streak ?? 0} />
          <XpBadge xp={xp?.total_xp ?? 0} />
        </div>
      </header>

      {/* Today's lesson */}
      {todaysLessonCourse ? (
        <section className="mt-6">
          <Eyebrow number="today">A small move</Eyebrow>
          <Link
            href={`/learn/${todaysLessonCourse.slug}`}
            className="mt-2 block rounded-lg border border-ink-200 bg-white p-5 sm:p-6 transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink-300 hover:shadow-card-hover"
          >
            <div className="flex items-start gap-4">
              <TutorAvatar
                personaId={
                  (profile?.preferred_tutor_persona as "nova" | "arjun" | "riya" | "sensei" | undefined) ?? "nova"
                }
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-ink-600">
                  Pick up where you left off — <span className="font-medium text-ink-900">{todaysLessonCourse.title}</span>.
                </p>
                <p className="mt-2 font-semibold text-lg text-ink-900">
                  {todaysLessonCourse.subtitle ?? todaysLessonCourse.title}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
                  <span className="font-tabular">{profile?.daily_goal_minutes ?? 10}</span>
                  <span>min</span>
                  <span className="text-ink-300">·</span>
                  <span>{todaysLessonCourse.title}</span>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-accent-600 shrink-0 mt-1" />
            </div>
          </Link>
        </section>
      ) : null}

      {inProgress.length > 0 ? (
        <CourseRow number="01" title="Continue" courses={inProgress} tier={tier} progressByCourse={progressByCourse} />
      ) : null}

      <CourseRow number="02" title="Starters"       courses={starters} tier={tier} progressByCourse={progressByCourse} />
      <CourseRow number="03" title="For you"        courses={forYou}   tier={tier} progressByCourse={progressByCourse} />
      <CourseRow number="04" title="Bonus bundles"  courses={bonus}    tier={tier} progressByCourse={progressByCourse} />

      <div className="mt-10 flex justify-center">
        <ButtonLink href="/learn" variant="ghost" size="md">See everything</ButtonLink>
      </div>
    </main>
  );
}

function CourseRow({
  number, title, courses, tier, progressByCourse,
}: {
  number: string;
  title: string;
  courses: Course[];
  tier: PlanTier;
  progressByCourse: Map<string, { progress_pct: number }>;
}) {
  if (courses.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <Eyebrow number={number}>{title}</Eyebrow>
        <Link href="/learn" className="text-xs text-ink-500 hover:text-ink-800 transition-colors duration-150 ease-out">
          more
        </Link>
      </div>
      <div className="mt-3 -mx-5 px-5 flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
        {courses.map((c) => (
          <div key={c.id} className="w-[68%] sm:w-[48%] shrink-0 snap-start">
            <CourseCard
              course={c}
              locked={!tierCanAccess(tier, c.plan_tier)}
              progressPct={progressByCourse.get(c.id)?.progress_pct}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
