import { cn } from "@/lib/utils";

type Padding = "none" | "sm" | "md" | "lg";
type Radius = "sm" | "md" | "lg" | "xl";

const pad: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};
const rad: Record<Radius, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  padding?: Padding;
  radius?: Radius;
  elevated?: boolean;
};

export function Card({
  padding = "md",
  radius = "lg",
  elevated = false,
  className,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "bg-white border border-ink-200",
        elevated && "shadow-card",
        pad[padding],
        rad[radius],
        className,
      )}
      {...rest}
    />
  );
}
