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
        "w-full text-left rounded-2xl border transition-[transform,border-color,background-color,opacity,box-shadow] duration-220 ease-warm",
        "px-5 py-4 flex items-start gap-4",
        "bg-paper-100 hover:-translate-y-[2px] hover:shadow-paper",
        selected
          ? "border-ember-500 bg-ember-50 shadow-paper"
          : "border-paper-200 hover:border-ink-200",
        dimmed && "opacity-30",
        className,
      )}
    >
      {emoji ? (
        <span className="text-2xl leading-none pt-[2px]" aria-hidden>{emoji}</span>
      ) : null}
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-serif text-lg text-ink-900">{title}</span>
          {recommended ? (
            <span className="eyebrow text-ember-600 border border-ember-200 rounded-full px-2 py-[2px] normal-case tracking-[0.14em]">recommended</span>
          ) : null}
        </span>
        {blurb ? <span className="block mt-1 text-sm text-ink-500">{blurb}</span> : null}
      </span>
      {multi ? (
        <span
          className={cn(
            "shrink-0 mt-1 inline-flex h-5 w-5 items-center justify-center rounded-[6px] border transition-colors",
            selected ? "bg-ember-500 border-ember-500" : "border-ink-300",
          )}
          aria-hidden
        >
          {selected ? (
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-paper-50" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 10l3 3 7-7" />
            </svg>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
