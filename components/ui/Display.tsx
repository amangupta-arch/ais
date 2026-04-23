import { cn } from "@/lib/utils";

type Size = "xl" | "lg" | "md";

const sizeClass: Record<Size, string> = {
  xl: "text-display-xl",
  lg: "text-display-lg",
  md: "text-display-md",
};

type Props = {
  as?: "h1" | "h2" | "h3" | "p";
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

export function Display({ as: Tag = "h1", size = "lg", className, children }: Props) {
  return (
    <Tag
      className={cn(
        "font-serif text-ink-900 display-press",
        sizeClass[size],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
