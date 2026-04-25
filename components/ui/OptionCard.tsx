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
        "lm-option",
        selected && "lm-option--correct",
        dimmed && "lm-option--dim",
        className,
      )}
    >
      {emoji ? (
        <span style={{ fontSize: 22, lineHeight: 1, paddingTop: 2 }} aria-hidden>{emoji}</span>
      ) : null}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="flex items-center" style={{ gap: 8 }}>
          <span
            className="lm-serif"
            style={{ fontSize: 16, lineHeight: 1.3, color: "inherit" }}
          >
            {title}
          </span>
          {recommended ? (
            <span
              className="lm-mono"
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--saffron-deep)",
                background: "var(--saffron-soft)",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              recommended
            </span>
          ) : null}
        </span>
        {blurb ? (
          <span
            style={{
              display: "block",
              marginTop: 4,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text-3)",
            }}
          >
            {blurb}
          </span>
        ) : null}
      </span>
      {multi ? (
        <span
          style={{
            flexShrink: 0,
            marginTop: 2,
            display: "inline-flex",
            width: 20,
            height: 20,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            border: selected ? "0" : "1.5px solid var(--border-strong)",
            background: selected ? "var(--moss)" : "transparent",
            transition: "background 160ms cubic-bezier(0.2, 0, 0, 1)",
          }}
          aria-hidden
        >
          {selected ? (
            <svg viewBox="0 0 20 20" style={{ width: 14, height: 14, color: "#fff" }} fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 10l3 3 7-7" />
            </svg>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}
