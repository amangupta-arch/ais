import { createClient } from "./server";
import type {
  Course, Lesson, Plan, Profile, UserStreak, UserXp, UserCourseProgress, UserLessonProgress,
} from "@/lib/types";
import type { LessonTurn } from "@/lib/turns";

export async function getMe(): Promise<{
  user: { id: string; email: string | null } | null;
  profile: Profile | null;
  streak: UserStreak | null;
  xp: UserXp | null;
  planId: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, streak: null, xp: null, planId: null };

  const [{ data: profile }, { data: streak }, { data: xp }, { data: sub }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_streaks").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_xp").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_id,status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: (profile ?? null) as Profile | null,
    streak: (streak ?? null) as UserStreak | null,
    xp: (xp ?? null) as UserXp | null,
    planId: sub?.plan_id ?? "free",
  };
}

export async function getAllCourses(): Promise<Course[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  return (data ?? []) as Course[];
}

export async function getCourseBySlug(slug: string): Promise<{ course: Course | null; lessons: Lesson[] }> {
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!course) return { course: null, lessons: [] };
  const { data: lessons } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", (course as Course).id)
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  return { course: course as Course, lessons: (lessons ?? []) as Lesson[] };
}

export async function getPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
  return (data ?? []).map((p) => ({ ...p, features: (p.features as string[]) ?? [] })) as Plan[];
}

export async function getMyCourseProgress(): Promise<UserCourseProgress[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_course_progress")
    .select("*")
    .eq("user_id", user.id);
  return (data ?? []) as UserCourseProgress[];
}

export async function getMyLessonProgress(courseId: string): Promise<UserLessonProgress[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("user_lesson_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("course_id", courseId);
  return (data ?? []) as UserLessonProgress[];
}

export async function getLessonByCourseAndSlug(
  courseSlug: string,
  lessonSlug: string,
): Promise<{
  course: Course | null;
  lesson: Lesson | null;
  turns: LessonTurn[];
  progress: UserLessonProgress | null;
}> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", courseSlug)
    .eq("is_published", true)
    .maybeSingle();
  if (!course) return { course: null, lesson: null, turns: [], progress: null };

  const { data: lesson } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", (course as Course).id)
    .eq("slug", lessonSlug)
    .eq("is_published", true)
    .maybeSingle();
  if (!lesson) return { course: course as Course, lesson: null, turns: [], progress: null };

  const { data: turnsData } = await supabase
    .from("lesson_turns")
    .select("*")
    .eq("lesson_id", (lesson as Lesson).id)
    .order("order_index", { ascending: true });

  const { data: { user } } = await supabase.auth.getUser();
  let progress: UserLessonProgress | null = null;
  if (user) {
    const { data: prog } = await supabase
      .from("user_lesson_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("lesson_id", (lesson as Lesson).id)
      .maybeSingle();
    progress = (prog ?? null) as UserLessonProgress | null;
  }

  return {
    course: course as Course,
    lesson: lesson as Lesson,
    turns: (turnsData ?? []) as unknown as LessonTurn[],
    progress,
  };
}
