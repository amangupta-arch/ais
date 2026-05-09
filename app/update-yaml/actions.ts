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

/** Sentinel value for the bundle dropdown's "orphan courses" option. */
export const ORPHAN_BUNDLE = "__orphan__" as const;
/** Sentinel value for the bundle dropdown's "all courses" option. */
export const ALL_BUNDLES = "__all__" as const;

/** Languages the renderer + loader recognise. EN is the canonical write
 *  path; everything else writes into `lessons.translations[<lang>]`. */
export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English (canonical)" },
  { code: "hinglish", label: "Hinglish" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "bn", label: "Bengali" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
] as const;

export type BundleOption = {
  id: string;
  slug: string;
  title: string | null;
  course_count: number;
};

export type CourseOption = {
  id: string;
  slug: string;
  title: string | null;
  lesson_count: number;
  bundle_id: string | null;
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
    /** Languages already authored for this lesson — keys present in the
     *  translations jsonb. EN is always present after the canonical load. */
    languages: string[];
  }>;
};

export async function listBundles(): Promise<BundleOption[]> {
  await requireAuthed();
  const admin = adminClient();
  // Pull bundles + a course count per bundle. PostgREST can't aggregate
  // cleanly with select(), so we do two queries and join in memory.
  const [{ data: bundles, error: bErr }, { data: courses, error: cErr }] = await Promise.all([
    admin.from("bundles").select("id, slug, translations").order("order_index", { ascending: true }),
    admin.from("courses").select("bundle_id"),
  ]);
  if (bErr) throw new Error(`list bundles: ${bErr.message}`);
  if (cErr) throw new Error(`count courses: ${cErr.message}`);
  const counts = new Map<string, number>();
  for (const c of courses ?? []) {
    const b = c.bundle_id as string | null;
    if (!b) continue;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return (bundles ?? []).map((b) => {
    const t = (b.translations as Record<string, { title?: string }> | null) ?? {};
    return {
      id: b.id as string,
      slug: b.slug as string,
      title: t.en?.title ?? null,
      course_count: counts.get(b.id as string) ?? 0,
    };
  });
}

export async function listCourses(args?: {
  bundleId?: string | typeof ORPHAN_BUNDLE | typeof ALL_BUNDLES;
}): Promise<CourseOption[]> {
  await requireAuthed();
  const admin = adminClient();
  let query = admin
    .from("courses")
    .select("id, slug, translations, lesson_count, bundle_id")
    .order("slug", { ascending: true });
  if (args?.bundleId === ORPHAN_BUNDLE) {
    query = query.is("bundle_id", null);
  } else if (args?.bundleId && args.bundleId !== ALL_BUNDLES) {
    query = query.eq("bundle_id", args.bundleId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`list courses: ${error.message}`);
  return (data ?? []).map((c) => {
    const t = (c.translations as Record<string, { title?: string }> | null) ?? {};
    return {
      id: c.id as string,
      slug: c.slug as string,
      title: t.en?.title ?? null,
      lesson_count: (c.lesson_count as number | null) ?? 0,
      bundle_id: (c.bundle_id as string | null) ?? null,
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
      languages: Object.keys(t).sort(),
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
  /** Language code for this YAML. "en" writes the canonical lesson row
   *  + lesson_turns. Anything else folds into lessons.translations[<lang>]
   *  as a full alternative document, leaving the canonical untouched. */
  language: string;
  /** Optional explicit slug. If omitted, slugified from the YAML title.
   *  For non-EN languages this MUST match an existing canonical slug. */
  slug?: string;
  /** Optional explicit order index. Ignored for non-EN languages. */
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
    language: string;
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

  // 3. Resolve slug.
  const slug = (args.slug && args.slug.trim()) || slugify(doc.title);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return {
      ok: false,
      message: `Invalid slug "${slug}" — must be lowercase, alphanumeric + hyphens, starting with a letter or digit.`,
    };
  }

  const admin = adminClient();
  const language = args.language || "en";

  // 4. Look up the course.
  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id, slug")
    .eq("id", args.courseId)
    .maybeSingle();
  if (courseErr) return { ok: false, message: `course lookup: ${courseErr.message}` };
  if (!course) return { ok: false, message: `Course ${args.courseId} not found.` };

  // ---------------- non-EN: translation overlay -----------------
  if (language !== "en") {
    const { data: existingLesson, error: lookupErr } = await admin
      .from("lessons")
      .select("id, translations")
      .eq("course_id", args.courseId)
      .eq("slug", slug)
      .maybeSingle();
    if (lookupErr) {
      return { ok: false, message: `lesson lookup: ${lookupErr.message}` };
    }
    if (!existingLesson) {
      return {
        ok: false,
        message: `No canonical lesson "${slug}" in this course. Author the English version first, then translate.`,
      };
    }

    const translatedTurns = doc.turns.map((turn, idx) => ({
      order_index: idx + 1,
      turn_type: turn.type,
      content: turnContent(turn),
      xp_reward: turnXpReward(turn),
    }));
    const langDoc: Record<string, unknown> = {
      title: doc.title,
      ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
      turns: translatedTurns,
    };
    const merged = {
      ...((existingLesson.translations as Record<string, unknown> | null) ?? {}),
      [language]: langDoc,
    };
    const { error: updErr } = await admin
      .from("lessons")
      .update({ translations: merged })
      .eq("id", existingLesson.id);
    if (updErr) return { ok: false, message: `update translations: ${updErr.message}` };

    revalidatePath("/database-schema");
    revalidatePath(`/learn/${course.slug}`);
    revalidatePath(`/learn/${course.slug}/${slug}`);

    // Read order_index back so the result reflects the canonical row.
    const { data: row } = await admin
      .from("lessons")
      .select("order_index")
      .eq("id", existingLesson.id)
      .single();
    return {
      ok: true,
      message: `Folded ${translatedTurns.length} ${language} turns into ${slug}.`,
      lesson: {
        id: existingLesson.id as string,
        slug,
        order_index: (row?.order_index as number) ?? 0,
        title: doc.title,
        turn_count: translatedTurns.length,
        language,
      },
    };
  }

  // ---------------- EN: canonical lesson upsert -----------------

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

  // 6. Read existing translations so we don't drop other lang keys.
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
      language: "en",
    },
  };
}
