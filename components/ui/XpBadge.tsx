import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  xp: number;
  className?: string;
};

export function XpBadge({ xp, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 h-8 bg-white text-ink-800 border border-ink-200 text-[13px]",
        className,
      )}
    >
      <Zap className="h-3.5 w-3.5 text-ink-500" aria-hidden />
      <span>
        <span className="font-tabular font-semibold">{xp}</span>
        <span className="text-ink-500 ml-1">XP</span>
      </span>
    </div>
  );
}
