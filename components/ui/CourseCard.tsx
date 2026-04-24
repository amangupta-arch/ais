import Link from "next/link";
import { Lock, Clock } from "lucide-react";
import type { Course } from "@/lib/types";
import { cn, formatTier } from "@/lib/utils";

type Props = {
  course: Course;
  locked?: boolean;
  progressPct?: number;
  className?: string;
};

export function CourseCard({ course, locked, progressPct, className }: Props) {
  const body = (
    <div
      className={cn(
        "group relative block rounded-lg border border-ink-200 bg-white overflow-hidden",
        "transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink-300 hover:shadow-card-hover",
        className,
      )}
    >
      <div className="h-20 flex items-center justify-center bg-ink-50 text-3xl border-b border-ink-200">
        <span aria-hidden>{course.emoji ?? "·"}</span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{formatTier(course.plan_tier)}</span>
          {course.is_bonus_badge ? (
            <span className="eyebrow text-accent-700">bonus</span>
          ) : null}
        </div>
        <h3 className="mt-2 font-semibold text-[16px] leading-snug text-ink-900">{course.title}</h3>
        {course.subtitle ? (
          <p className="mt-1 text-sm text-ink-600">{course.subtitle}</p>
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
          <div className="mt-3 h-[3px] rounded-sm bg-ink-100 overflow-hidden">
            <div
              className="h-full bg-accent-600"
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        ) : null}
      </div>

      {locked ? (
        <div className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-sm bg-white/95 backdrop-blur border border-ink-200">
          <Lock className="h-3.5 w-3.5 text-ink-500" />
        </div>
      ) : null}
    </div>
  );

  if (locked) return body;
  return <Link href={`/learn/${course.slug}`}>{body}</Link>;
}
