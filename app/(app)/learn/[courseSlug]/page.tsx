import { notFound, redirect } from "next/navigation";

import { getCourseBySlug, getMe, getMyLessonProgress } from "@/lib/supabase/queries";
import type { PlanTier, UserLessonProgress } from "@/lib/types";

import CourseDetailView from "./CourseDetailView";

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
  const { user, profile, planId, streak } = await getMe();
  if (!user) redirect("/login");

  const { course, lessons } = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const lang = profile?.preferred_language ?? "en";
  const tier: PlanTier = (planId as PlanTier) ?? "free";
  const locked = !tierCanAccess(tier, course.plan_tier);
  const progress = await getMyLessonProgress(course.id);
  const progByLesson: Record<string, UserLessonProgress> = Object.fromEntries(
    progress.map((p) => [p.lesson_id, p]),
  );

  return (
    <CourseDetailView
      course={course}
      lessons={lessons}
      progByLesson={progByLesson}
      lang={lang}
      locked={locked}
      streak={streak?.current_streak ?? 0}
    />
  );
}
