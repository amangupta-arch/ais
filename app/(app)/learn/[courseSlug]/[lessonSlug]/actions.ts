"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type AdvanceArgs = {
  courseId: string;
  lessonId: string;
  turnIndex: number; // zero-based index of the turn just completed
  xpAwarded?: number;
  source?: string;   // tag for xp_events.source
};

export async function advanceTurn(args: AdvanceArgs): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("user_lesson_progress")
    .select("current_turn_index, xp_earned, status, started_at")
    .eq("user_id", user.id)
    .eq("lesson_id", args.lessonId)
    .maybeSingle();

  const nextTurnIndex = Math.max(existing?.current_turn_index ?? 0, args.turnIndex + 1);
  const xp = args.xpAwarded ?? 0;
  const xpEarned = (existing?.xp_earned ?? 0) + xp;
  const startedAt = existing?.started_at ?? new Date().toISOString();

  await supabase.from("user_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: args.lessonId,
      course_id: args.courseId,
      status: existing?.status === "completed" ? "completed" : "in_progress",
      current_turn_index: nextTurnIndex,
      xp_earned: xpEarned,
      started_at: startedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );

  if (xp > 0) {
    await supabase.from("xp_events").insert({
      user_id: user.id,
      xp_amount: xp,
      source: args.source ?? "lesson_turn",
      reference_id: args.lessonId,
    });
    await bumpUserXp(user.id, xp);
  }
}

export async function completeLesson(args: {
  courseId: string;
  lessonId: string;
  lessonXpReward: number;
}): Promise<{ awarded: number; alreadyCompleted: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { awarded: 0, alreadyCompleted: false };

  const { data: existing } = await supabase
    .from("user_lesson_progress")
    .select("status, xp_earned, started_at")
    .eq("user_id", user.id)
    .eq("lesson_id", args.lessonId)
    .maybeSingle();

  if (existing?.status === "completed") {
    return { awarded: 0, alreadyCompleted: true };
  }

  const now = new Date().toISOString();
  const xp = args.lessonXpReward;

  await supabase.from("user_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: args.lessonId,
      course_id: args.courseId,
      status: "completed",
      xp_earned: (existing?.xp_earned ?? 0) + xp,
      started_at: existing?.started_at ?? now,
      completed_at: now,
      updated_at: now,
    },
    { onConflict: "user_id,lesson_id" },
  );

  await supabase.from("xp_events").insert({
    user_id: user.id,
    xp_amount: xp,
    source: "lesson_complete",
    reference_id: args.lessonId,
  });
  await bumpUserXp(user.id, xp);

  // Recompute course progress.
  const { count: doneCount } = await supabase
    .from("user_lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("course_id", args.courseId)
    .eq("status", "completed");

  const { count: totalCount } = await supabase
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("course_id", args.courseId)
    .eq("is_published", true);

  const pct = totalCount && totalCount > 0
    ? Math.min(100, Math.round(((doneCount ?? 0) / totalCount) * 100))
    : 0;
  const courseStatus = pct >= 100 ? "completed" : "in_progress";

  await supabase.from("user_course_progress").upsert(
    {
      user_id: user.id,
      course_id: args.courseId,
      status: courseStatus,
      progress_pct: pct,
      last_lesson_id: args.lessonId,
      started_at: now,
      completed_at: courseStatus === "completed" ? now : null,
      updated_at: now,
    },
    { onConflict: "user_id,course_id" },
  );

  // Streak bump — Postgres function handles freeze + same-day idempotency.
  await supabase.rpc("bump_streak", { p_user_id: user.id });

  revalidatePath("/home");
  revalidatePath("/profile");

  return { awarded: xp, alreadyCompleted: false };
}

async function bumpUserXp(userId: string, xp: number): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("user_xp")
    .select("total_xp, weekly_xp, week_started_at")
    .eq("user_id", userId)
    .maybeSingle();

  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const weekStartedAt = row?.week_started_at ?? todayDate;
  const weekStart = new Date(weekStartedAt + "T00:00:00Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const inSameWeek = today.getTime() - weekStart.getTime() < sevenDaysMs;

  await supabase.from("user_xp").upsert(
    {
      user_id: userId,
      total_xp: (row?.total_xp ?? 0) + xp,
      weekly_xp: inSameWeek ? (row?.weekly_xp ?? 0) + xp : xp,
      week_started_at: inSameWeek ? weekStartedAt : todayDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}
