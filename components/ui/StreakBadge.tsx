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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 border text-[13px]",
        active
          ? "bg-accent-50 text-accent-700 border-accent-200"
          : "bg-white text-ink-600 border-ink-200",
        className,
      )}
    >
      <Flame className={cn("h-3.5 w-3.5", active ? "text-accent-600" : "text-ink-400")} aria-hidden />
      <span>
        <span className="font-tabular font-semibold">{days}</span>
        <span className="text-ink-500 ml-1">{days === 1 ? "day" : "days"}</span>
      </span>
    </div>
  );
}
