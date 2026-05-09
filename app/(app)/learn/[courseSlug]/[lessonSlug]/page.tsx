import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LessonPlayer } from "./LessonPlayer";

import { getLessonByCourseAndSlug, getMe } from "@/lib/supabase/queries";
import type { Persona } from "@/lib/types";
import { lessonTitle, lessonSubtitle } from "@/lib/types";
import { localizeTurn } from "@/lib/turns";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;
  const { user, profile } = await getMe();
  if (!user) redirect(`/login?next=/learn/${courseSlug}/${lessonSlug}`);

  const { course, lesson, turns, progress } = await getLessonByCourseAndSlug(courseSlug, lessonSlug);
  if (!course || !lesson) notFound();

  const preferredLang = profile?.preferred_language ?? "en";

  if (turns.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 pt-8 pb-10">
        <Link href={`/learn/${courseSlug}`} className="text-sm text-ink-500 hover:text-ink-800 transition-colors">← back to course</Link>
        <div className="mt-8 rounded-3xl border border-paper-200 bg-paper-100 shadow-paper p-8">
          <Eyebrow>not authored yet</Eyebrow>
          <Display as="h1" size="md" className="mt-3">
            This lesson is <em className="italic font-normal">still being written</em>.
          </Display>
          <p className="mt-4 text-ink-600 leading-relaxed">Come back soon.</p>
        </div>
      </main>
    );
  }

  return (
    <LessonPlayer
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
      lessonTitle={lessonTitle(lesson, preferredLang)}
      lessonSubtitle={lessonSubtitle(lesson, preferredLang)}
      lessonXpReward={lesson.xp_reward}
      courseId={course.id}
      lessonId={lesson.id}
      turns={turns.map((t) => localizeTurn(t, preferredLang))}
      personaId={(profile?.preferred_tutor_persona as Persona["id"]) ?? "nova"}
      initialTurnIndex={progress?.current_turn_index ?? 0}
      alreadyCompleted={progress?.status === "completed"}
    />
  );
}
