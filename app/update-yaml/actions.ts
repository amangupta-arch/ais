"use server";

import yaml from "js-yaml";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { lessonSchema, turnContent, turnXpReward } from "@/lib/content/schema";
import { createClient } from "@/lib/supabase/server";

/** Service-role client for the writes. Uses the same env var the
 *  scripts/load-content.ts CLI uses. Server-only. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set on the server. /update-yaml needs it to write lessons.",
    );
  }
  return createServerClient(url, key, { auth: { persistSession: false } });
}

async function requireAuthed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

export type CourseOption = {
  id: string;
  slug: string;
  title: string | null;
  lesson_count: number;
};

/** Lesson list for the picked course — used to display the next slot
 *  the author should fill, and a quick view of what's already there. */
export type CourseStats = {
  nextOrderIndex: number;
  lessons: Array<{
    slug: string;
    order_index: number;
    title: string | null;
    is_published: boolean;
  }>;
};

export async function listCourses(): Promise<CourseOption[]> {
  await requireAuthed();
  const admin = adminClient();
  // Pull all published + unpublished — authors need to fill empty courses too.
  const { data, error } = await admin
    .from("courses")
    .select("id, slug, translations, lesson_count")
    .order("slug", { ascending: true });
  if (error) throw new Error(`list courses: ${error.message}`);
  return (data ?? []).map((c) => {
    const t = (c.translations as Record<string, { title?: string }> | null) ?? {};
    return {
      id: c.id as string,
      slug: c.slug as string,
      title: t.en?.title ?? null,
      lesson_count: (c.lesson_count as number | null) ?? 0,
    };
  });
}

export async function getCourseStats(courseId: string): Promise<CourseStats> {
  await requireAuthed();
  const admin = adminClient();
  const { data, error } = await admin
    .from("lessons")
    .select("slug, order_index, translations, is_published")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(`list lessons: ${error.message}`);
  const lessons = (data ?? []).map((l) => {
    const t = (l.translations as Record<string, { title?: string }> | null) ?? {};
    return {
      slug: l.slug as string,
      order_index: l.order_index as number,
      title: t.en?.title ?? null,
      is_published: l.is_published as boolean,
    };
  });
  const nextOrderIndex =
    lessons.length === 0
      ? 1
      : Math.max(...lessons.map((l) => l.order_index)) + 1;
  return { nextOrderIndex, lessons };
}

/** Slugify a string the same way the YAML filename convention expects:
 *  lowercase, hyphens for separators, alphanumeric + hyphens only. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type SubmitArgs = {
  courseId: string;
  yamlText: string;
  /** Optional explicit slug. If omitted, slugified from the YAML title. */
  slug?: string;
  /** Optional explicit order index. If omitted, uses next available. */
  orderIndex?: number;
};

export type SubmitResult = {
  ok: boolean;
  message: string;
  lesson?: {
    id: string;
    slug: string;
    order_index: number;
    title: string;
    turn_count: number;
  };
};

export async function submitLessonYaml(args: SubmitArgs): Promise<SubmitResult> {
  await requireAuthed();

  // 1. Parse YAML.
  let raw: unknown;
  try {
    raw = yaml.load(args.yamlText);
  } catch (e) {
    return { ok: false, message: `YAML parse error: ${String(e)}` };
  }

  // 2. Validate against the lesson schema.
  const parsed = lessonSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    return { ok: false, message: `Validation failed:\n${issues}` };
  }
  const doc = parsed.data;

  // 3. Resolve slug + order index.
  const slug = (args.slug && args.slug.trim()) || slugify(doc.title);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return {
      ok: false,
      message: `Invalid slug "${slug}" — must be lowercase, alphanumeric + hyphens, starting with a letter or digit.`,
    };
  }

  const admin = adminClient();

  // 4. Look up the course.
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id, slug")
    .eq("id", args.courseId)
    .maybeSingle();
  if (courseErr) return { ok: false, message: `course lookup: ${courseErr.message}` };
  if (!course) return { ok: false, message: `Course ${args.courseId} not found.` };

  // 5. Decide order_index.
  let orderIndex = args.orderIndex ?? 0;
  if (!orderIndex || orderIndex < 1) {
    const { data: existing } = await admin
      .from("lessons")
      .select("slug, order_index")
      .eq("course_id", args.courseId);
    // If a lesson with this slug already exists, reuse its order_index
    // (overwrite-in-place). Otherwise use max+1.
    const match = (existing ?? []).find((l) => l.slug === slug);
    orderIndex = match
      ? (match.order_index as number)
      : ((existing ?? []).reduce((m, l) => Math.max(m, l.order_index as number), 0) + 1);
  }

  // 6. Read existing translations.en if any so we don't drop other lang keys.
  const { data: existingLesson } = await admin
    .from("lessons")
    .select("id, translations")
    .eq("course_id", args.courseId)
    .eq("slug", slug)
    .maybeSingle();
  const existingTrans =
    (existingLesson?.translations as Record<string, unknown> | null) ?? {};
  const translations: Record<string, unknown> = {
    ...existingTrans,
    en: {
      title: doc.title,
      ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
    },
  };

  // 7. Upsert the lesson row.
  const { data: lessonRow, error: upsertErr } = await admin
    .from("lessons")
    .upsert(
      {
        course_id: args.courseId,
        slug,
        translations,
        order_index: orderIndex,
        estimated_minutes: doc.estimated_minutes,
        xp_reward: doc.xp_reward,
        format: "ai_chat",
        is_published: true,
      },
      { onConflict: "course_id,slug" },
    )
    .select("id")
    .single();
  if (upsertErr || !lessonRow) {
    return { ok: false, message: `upsert lesson: ${upsertErr?.message ?? "unknown error"}` };
  }
  const lessonId = lessonRow.id as string;

  // 8. Replace lesson_turns wholesale.
  const { error: delErr } = await admin
    .from("lesson_turns")
    .delete()
    .eq("lesson_id", lessonId);
  if (delErr) return { ok: false, message: `clear turns: ${delErr.message}` };

  const turnRows = doc.turns.map((turn, idx) => ({
    lesson_id: lessonId,
    order_index: idx + 1,
    turn_type: turn.type,
    content: turnContent(turn),
    xp_reward: turnXpReward(turn),
    is_required: true,
  }));
  const { error: insErr } = await admin.from("lesson_turns").insert(turnRows);
  if (insErr) return { ok: false, message: `insert turns: ${insErr.message}` };

  // 9. Refresh the dashboard view.
  revalidatePath("/database-schema");
  revalidatePath(`/learn/${course.slug}`);

  return {
    ok: true,
    message: `Loaded ${slug} (order ${orderIndex}) with ${turnRows.length} turns.`,
    lesson: {
      id: lessonId,
      slug,
      order_index: orderIndex,
      title: doc.title,
      turn_count: turnRows.length,
    },
  };
}
