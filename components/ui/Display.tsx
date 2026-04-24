import { cn } from "@/lib/utils";

type Size = "xl" | "lg" | "md" | "sm";

const sizeClass: Record<Size, string> = {
  xl: "text-display-xl",
  lg: "text-display-lg",
  md: "text-display-md",
  sm: "text-display-sm",
};

type Props = {
  as?: "h1" | "h2" | "h3" | "h4" | "p";
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

export function Display({ as: Tag = "h1", size = "lg", className, children }: Props) {
  return (
    <Tag className={cn("text-ink-900", sizeClass[size], className)}>
      {children}
    </Tag>
  );
}
