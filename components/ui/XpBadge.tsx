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
        "inline-flex items-center gap-2 rounded-full px-3 h-9 bg-paper-200 text-ink-800 border border-paper-300",
        className,
      )}
    >
      <Zap className="h-4 w-4 text-ink-600" aria-hidden />
      <span className="text-[15px] leading-none">
        <span className="font-tabular font-medium">{xp}</span>
        <span className="text-ink-500 ml-1">XP</span>
      </span>
    </div>
  );
}
