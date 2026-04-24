"use client";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  blurb?: string;
  emoji?: string;
  selected?: boolean;
  dimmed?: boolean;
  recommended?: boolean;
  onClick?: () => void;
  className?: string;
  multi?: boolean;
};

export function OptionCard({
  title, blurb, emoji, selected, dimmed, recommended, onClick, className, multi,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected ? true : false}
      className={cn(
        "w-full text-left rounded-md border transition-[border-color,background-color,opacity] duration-150 ease-out",
        "px-4 py-3 flex items-start gap-3",
        selected
          ? "border-accent-600 bg-accent-50"
          : "border-ink-200 bg-white hover:border-ink-300",
        dimmed && "opacity-40",
        className,
      )}
    >
      {emoji ? (
        <span className="text-xl leading-none pt-[2px]" aria-hidden>{emoji}</span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-medium text-[15px] text-ink-900">{title}</span>
          {recommended ? (
            <span className="eyebrow text-accent-700 bg-accent-50 border border-accent-200 rounded-sm px-1.5 py-[2px]">recommended</span>
          ) : null}
        </span>
        {blurb ? <span className="block mt-1 text-sm text-ink-600">{blurb}</span> : null}
      </span>
      {multi ? (
        <span
          className={cn(
            "shrink-0 mt-1 inline-flex h-5 w-5 items-center justify-center rounded-sm border transition-colors",
            selected ? "bg-accent-600 border-accent-600" : "border-ink-300",
          )}
          aria-hidden
        >
          {selected ? (
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 10l3 3 7-7" />
            </svg>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
