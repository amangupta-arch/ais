import { createClient } from "./server";
import type {
  Bundle,
  Course, Lesson, Plan, Profile, UserStreak, UserXp, UserCourseProgress, UserLessonProgress,
} from "@/lib/types";
import type { LessonTurn } from "@/lib/turns";

/** Per-turn audio playlist: keyed by lesson_turns.order_index, each
 *  entry is an array of mp3 URLs to play in order (some turn types
 *  emit 2+ chunks — e.g. fill_in_the_blank prompt + template,
 *  checkpoint title + summary). Empty / missing key = no manifest
 *  entry, fall back to browser TTS or silence at the player. */
export type LessonAudioManifest = Record<number, string[]>;

/** Loads the ElevenLabs manifest for a lesson in one language and
 *  resolves each row to a public storage URL. Returns {} when no
 *  audio has been generated yet (or when the env vars aren't set,
 *  so the lesson page never blows up just because audio is missing). */
export async function getLessonAudioManifest(
  lessonId: string,
  language: string,
): Promise<LessonAudioManifest> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_audio_manifest")
    .select("turn_index, chunk_index, asset:lesson_audio_assets(storage_path)")
    .eq("lesson_id", lessonId)
    .eq("language", language)
    .order("turn_index", { ascending: true })
    .order("chunk_index", { ascending: true });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return {};

  const out: LessonAudioManifest = {};
  for (const row of (data ?? []) as unknown as Array<{
    turn_index: number;
    chunk_index: number;
    asset: { storage_path: string } | { storage_path: string }[] | null;
  }>) {
    // PostgREST returns the joined row as an object or single-element
    // array depending on whether the relationship is many-to-one;
    // normalise both shapes.
    const asset = Array.isArray(row.asset) ? row.asset[0] : row.asset;
    if (!asset?.storage_path) continue;
    const url = `${supabaseUrl}/storage/v1/object/public/lesson-audio/${asset.storage_path}`;
    const arr = out[row.turn_index] ?? [];
    arr.push(url);
    out[row.turn_index] = arr;
  }
  return out;
}

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

export async function getAllBundles(): Promise<Bundle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bundles")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  return (data ?? []) as Bundle[];
}

export async function getBundleBySlug(
  slug: string,
): Promise<{ bundle: Bundle | null; courses: Course[] }> {
  const supabase = await createClient();
  const { data: bundle } = await supabase
    .from("bundles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!bundle) return { bundle: null, courses: [] };
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("bundle_id", (bundle as Bundle).id)
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  return { bundle: bundle as Bundle, courses: (courses ?? []) as Course[] };
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

export async function getLessonsByCourseId(courseId: string): Promise<Lesson[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("order_index", { ascending: true });
  return (data ?? []) as Lesson[];
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
