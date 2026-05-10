import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { LessonPlayer } from "./LessonPlayer";

import { getLessonAudioManifest, getLessonByCourseAndSlug, getMe } from "@/lib/supabase/queries";
import type { Persona } from "@/lib/types";
import { lessonTitle, lessonSubtitle } from "@/lib/types";
import { localizeTurn, type LessonTurn } from "@/lib/turns";

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

  // Translation strategy:
  //   1. If `lesson.translations[<lang>].turns` exists, the lesson has a
  //      full alternative document for this language — use it verbatim.
  //      Lessons may have different turn counts per language.
  //   2. Otherwise, run each canonical turn through `localizeTurn` so
  //      any per-field overrides in `lesson_turns.translations[<lang>]`
  //      apply (the Phase 3 path).
  //   3. EN users always get the canonical content; localizeTurn is a
  //      no-op when there's no override.
  const translatedTurns = lesson.translations?.[preferredLang]?.turns;
  const displayTurns: LessonTurn[] =
    preferredLang !== "en" && translatedTurns && translatedTurns.length > 0
      ? translatedTurns.map((t, idx) => ({
          // Synthetic id keyed by lesson+lang+idx — stable for React
          // and for progress (current_turn_index) tracking.
          id: `${lesson.id}-${preferredLang}-${idx}`,
          order_index: t.order_index ?? idx + 1,
          turn_type: t.turn_type,
          content: t.content,
          translations: {},
          xp_reward: t.xp_reward ?? 0,
          is_required: true,
        }) as LessonTurn)
      : turns.map((t) => localizeTurn(t, preferredLang));

  if (displayTurns.length === 0) {
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

  // If the saved progress was on a different language, reset to turn 0.
  // Translated turn lists can have a different length and structure than
  // the canonical, so a turn index from another language can land past
  // the end or skip content. The user can scroll forward as before.
  const progressLang = (progress?.language as string | undefined) ?? "en";
  const sameLanguage = progressLang === preferredLang;
  const safeInitialTurnIndex = sameLanguage ? (progress?.current_turn_index ?? 0) : 0;

  // ElevenLabs mp3 manifest for this (lesson, language) — when present
  // the player plays these urls instead of using the browser TTS.
  //
  // Audio language must match the TEXT that's actually on screen. When
  // the learner picks Hindi but no Hindi translation exists, we fall
  // back to canonical (English) text above; without this mirror, the
  // player would ask for Hindi audio, get nothing, and silently switch
  // to browser TTS — which sounds noticeably worse than the English
  // ElevenLabs narration of the same content. So: if we showed
  // translated text, ask for translated audio; if we showed English
  // text, ask for English audio.
  const showingTranslatedText =
    preferredLang !== "en" && !!translatedTurns && translatedTurns.length > 0;
  const audioLang = showingTranslatedText ? preferredLang : "en";
  const audioByTurn = await getLessonAudioManifest(lesson.id, audioLang);

  return (
    <LessonPlayer
      courseSlug={courseSlug}
      lessonSlug={lessonSlug}
      lessonTitle={lessonTitle(lesson, preferredLang)}
      lessonSubtitle={lessonSubtitle(lesson, preferredLang)}
      lessonXpReward={lesson.xp_reward}
      courseId={course.id}
      lessonId={lesson.id}
      turns={displayTurns}
      personaId={(profile?.preferred_tutor_persona as Persona["id"]) ?? "nova"}
      initialTurnIndex={safeInitialTurnIndex}
      alreadyCompleted={progress?.status === "completed"}
      language={preferredLang}
      audioByTurn={audioByTurn}
    />
  );
}
