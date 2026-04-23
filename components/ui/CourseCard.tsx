import Link from "next/link";
import { Lock, Clock } from "lucide-react";
import type { Course } from "@/lib/types";
import { cn, formatTier } from "@/lib/utils";

const gradientByKey: Record<string, string> = {
  ember: "bg-gradient-to-br from-ember-100 to-ember-50",
  moss:  "bg-gradient-to-br from-[#E5ECD8] to-[#F3F1E0]",
  paper: "bg-gradient-to-br from-paper-200 to-paper-100",
};

type Props = {
  course: Course;
  locked?: boolean;
  progressPct?: number;
  className?: string;
};

export function CourseCard({ course, locked, progressPct, className }: Props) {
  const gradient = gradientByKey[course.cover_gradient ?? "paper"] ?? gradientByKey.paper!;

  const body = (
    <div
      className={cn(
        "group relative block rounded-2xl border border-paper-200 bg-paper-100 shadow-paper overflow-hidden",
        "transition-[transform,box-shadow] duration-220 ease-warm hover:-translate-y-[2px] hover:shadow-paper-lg",
        className,
      )}
    >
      <div className={cn("h-28 flex items-center justify-center text-4xl", gradient)}>
        <span aria-hidden>{course.emoji ?? "✺"}</span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{formatTier(course.plan_tier)}</span>
          {course.is_bonus_badge ? (
            <span className="eyebrow text-ember-600">bonus</span>
          ) : null}
        </div>
        <h3 className="mt-2 font-serif text-ink-900 text-lg leading-snug">{course.title}</h3>
        {course.subtitle ? (
          <p className="mt-1 text-sm text-ink-500 italic font-serif">{course.subtitle}</p>
        ) : null}

        <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-tabular">{course.estimated_minutes}</span> min
          </span>
          <span className="text-ink-300">·</span>
          <span className="capitalize">{course.difficulty}</span>
        </div>

        {typeof progressPct === "number" && progressPct > 0 ? (
          <div className="mt-3 h-[3px] rounded-full bg-paper-200 overflow-hidden">
            <div
              className="h-full bg-ember-500"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        ) : null}
      </div>

      {locked ? (
        <div className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-paper-50/90 backdrop-blur border border-paper-300">
          <Lock className="h-4 w-4 text-ink-500" />
        </div>
      ) : null}
    </div>
  );

  if (locked) return body;
  return <Link href={`/learn/${course.slug}`}>{body}</Link>;
}
