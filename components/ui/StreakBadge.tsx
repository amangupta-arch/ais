import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  days: number;
  className?: string;
};

export function StreakBadge({ days, className }: Props) {
  const active = days > 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 h-9",
        active ? "bg-ember-50 text-ember-700 border border-ember-200" : "bg-paper-200 text-ink-500 border border-paper-300",
        className,
      )}
    >
      <Flame className={cn("h-4 w-4", active ? "text-ember-500" : "text-ink-400")} aria-hidden />
      <span className="text-[15px] leading-none">
        <span className="font-tabular font-medium">{days}</span>
        <span className="text-ink-500 ml-1">{days === 1 ? "day" : "days"}</span>
      </span>
    </div>
  );
}
