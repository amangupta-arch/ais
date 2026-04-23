import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Check, MessageCircle, Sparkles, Target } from "lucide-react";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TutorAvatar } from "@/components/ui/TutorAvatar";

import { getLessonByCourseAndSlug, getMe } from "@/lib/supabase/queries";
import type { LessonTurn } from "@/lib/turns";
import type { Persona } from "@/lib/types";
import { personaById } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseSlug: string; lessonSlug: string }>;
}) {
  const { courseSlug, lessonSlug } = await params;
  const { user, profile } = await getMe();
  if (!user) redirect(`/login?next=/learn/${courseSlug}/${lessonSlug}`);

  const { course, lesson, turns } = await getLessonByCourseAndSlug(courseSlug, lessonSlug);
  if (!course || !lesson) notFound();

  const persona = personaById((profile?.preferred_tutor_persona as Persona["id"]) ?? "nova");

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-20">
      <Link href={`/learn/${courseSlug}`} className="text-sm text-ink-500 hover:text-ink-800 transition-colors">
        ← back to {course.title}
      </Link>

      <header className="mt-6 flex items-start gap-4">
        <TutorAvatar personaId={persona.id} size="lg" />
        <div className="flex-1 min-w-0">
          <Eyebrow>lesson · preview</Eyebrow>
          <Display as="h1" size="md" className="mt-1">
            {lesson.title}
          </Display>
          {lesson.subtitle ? (
            <p className="mt-2 italic font-serif text-ink-600">{lesson.subtitle}</p>
          ) : null}
          <p className="mt-3 text-xs text-ink-500">
            with {persona.name} ·{" "}
            <span className="font-tabular">{lesson.estimated_minutes}</span> min ·{" "}
            <span className="font-tabular">+{lesson.xp_reward}</span> XP on completion ·{" "}
            <span className="font-tabular">{turns.length}</span> turns
          </p>
        </div>
      </header>

      {turns.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-paper-200 bg-paper-100 shadow-paper p-8">
          <p className="font-serif text-xl text-ink-900">Not authored yet.</p>
          <p className="mt-2 text-ink-600">
            This lesson exists in the catalogue but has no turns. Add a YAML under{" "}
            <code className="bg-paper-200 px-1.5 py-0.5 rounded text-[12px]">
              supabase/content/{courseSlug}/
            </code>
            .
          </p>
        </div>
      ) : (
        <ol className="mt-8 flex flex-col gap-3">
          {turns.map((turn, i) => (
            <TurnCard key={turn.id} index={i} turn={turn} persona={persona} />
          ))}
        </ol>
      )}

      <div className="mt-10 rounded-2xl border border-dashed border-paper-300 px-5 py-4 text-sm text-ink-500">
        <p>
          This is a <em className="italic font-normal">preview</em> of the lesson structure. The interactive chat walkthrough lands in the next batch — same turns, animated and one at a time.
        </p>
      </div>
    </main>
  );
}

function TurnCard({
  index,
  turn,
  persona,
}: {
  index: number;
  turn: LessonTurn;
  persona: Persona;
}) {
  const num = (index + 1).toString().padStart(2, "0");
  const xp = turn.xp_reward;

  return (
    <li
      className={cn(
        "rounded-2xl border bg-paper-100 shadow-paper p-5",
        "border-paper-200",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">
          <span className="font-tabular">{num}</span> · {labelForTurn(turn.turn_type)}
        </span>
        {xp > 0 ? (
          <span className="eyebrow text-ember-600">
            +<span className="font-tabular">{xp}</span> xp
          </span>
        ) : null}
      </div>

      <div className="mt-3">{renderTurnPreview(turn, persona)}</div>
    </li>
  );
}

function labelForTurn(type: LessonTurn["turn_type"]): string {
  switch (type) {
    case "tutor_message":   return "tutor speaks";
    case "mcq":             return "multiple choice";
    case "free_text":       return "open answer · ai-graded";
    case "reflection":      return "reflection";
    case "exercise":        return "exercise · external tool";
    case "ai_conversation": return "sub-chat with tutor";
    case "checkpoint":      return "checkpoint";
    case "media":           return "media";
  }
}

function renderTurnPreview(turn: LessonTurn, persona: Persona): React.ReactNode {
  switch (turn.turn_type) {
    case "tutor_message": {
      const speaker = personaById(turn.content.persona_id ?? persona.id);
      return (
        <div className="flex items-start gap-3">
          <TutorAvatar personaId={speaker.id} size="sm" />
          <p className="font-serif text-[17px] leading-snug text-ink-900 whitespace-pre-line">
            {turn.content.text}
          </p>
        </div>
      );
    }

    case "mcq":
      return (
        <div>
          <p className="font-serif text-[17px] text-ink-900">{turn.content.question}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {turn.content.options.map((o) => (
              <li
                key={o.id}
                className={cn(
                  "rounded-xl border px-4 py-3 text-[15px] flex items-start gap-3",
                  o.is_correct
                    ? "border-moss-400/40 bg-[#F1F4E8] text-ink-900"
                    : "border-paper-200 bg-paper-50 text-ink-700",
                )}
              >
                <span className="font-tabular text-xs uppercase pt-[3px] text-ink-500">{o.id}</span>
                <span className="flex-1">
                  {o.text}
                  {o.rationale ? (
                    <span className="block mt-1 italic font-serif text-sm text-ink-600">
                      → {o.rationale}
                    </span>
                  ) : null}
                </span>
                {o.is_correct ? <Check className="h-4 w-4 text-moss-500 mt-1" /> : null}
              </li>
            ))}
          </ul>
        </div>
      );

    case "free_text":
      return (
        <div>
          <p className="font-serif text-[17px] text-ink-900">{turn.content.prompt}</p>
          <div className="mt-3 rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-ink-500">
            {turn.content.placeholder ?? "Open answer — graded by Claude."}
          </div>
          {turn.content.rubric ? (
            <p className="mt-2 text-xs text-ink-500 italic">Rubric: {turn.content.rubric}</p>
          ) : null}
        </div>
      );

    case "reflection":
      return (
        <div>
          <p className="font-serif text-[17px] text-ink-900">{turn.content.prompt}</p>
          <div className="mt-3 rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-ink-500">
            {turn.content.placeholder ?? "A note for yourself — never sent anywhere."}
          </div>
        </div>
      );

    case "exercise":
      return (
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-ember-50 border border-ember-200 px-3 py-1 text-xs text-ember-700">
            <Sparkles className="h-3.5 w-3.5" />
            opens {turn.content.tool ?? "another tab"}
          </div>
          <p className="mt-3 font-serif text-[17px] text-ink-900 whitespace-pre-line">
            {turn.content.instruction}
          </p>
          {turn.content.placeholder ? (
            <div className="mt-3 rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-sm text-ink-500">
              {turn.content.placeholder}
            </div>
          ) : null}
        </div>
      );

    case "ai_conversation":
      return (
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <MessageCircle className="h-3.5 w-3.5" />
            sub-chat · max <span className="font-tabular">{turn.content.max_turns}</span> turns
          </div>
          <p className="mt-3 font-serif text-[17px] italic text-ink-900">
            "{turn.content.starter_text}"
          </p>
          <p className="mt-2 inline-flex items-start gap-2 text-xs text-ink-500">
            <Target className="h-3.5 w-3.5 mt-[2px]" />
            <span>Goal: {turn.content.goal}</span>
          </p>
        </div>
      );

    case "media":
      return (
        <div>
          <div className="rounded-xl bg-paper-200 border border-paper-300 p-4 text-sm text-ink-600">
            {turn.content.kind} · <a href={turn.content.url} className="underline">open</a>
          </div>
          {turn.content.caption ? (
            <p className="mt-2 italic font-serif text-sm text-ink-600">{turn.content.caption}</p>
          ) : null}
        </div>
      );

    case "checkpoint":
      return (
        <div className="rounded-2xl border border-ember-200 bg-ember-50 p-5">
          <div className="flex items-center gap-2 text-ember-700">
            <ArrowRight className="h-4 w-4" />
            <span className="eyebrow">checkpoint</span>
          </div>
          <p className="mt-2 font-serif text-2xl text-ink-900">{turn.content.title}</p>
          <p className="mt-2 text-ink-700 leading-relaxed whitespace-pre-line">
            {turn.content.summary}
          </p>
        </div>
      );
  }
}

