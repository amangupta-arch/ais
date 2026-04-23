import { cn } from "@/lib/utils";

type Padding = "none" | "sm" | "md" | "lg";
type Radius = "xl" | "2xl" | "3xl";

const pad: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6 sm:p-8",
};
const rad: Record<Radius, string> = {
  xl:  "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

type Props = React.HTMLAttributes<HTMLDivElement> & {
  padding?: Padding;
  radius?: Radius;
  elevated?: boolean;
};

export function Card({
  padding = "md",
  radius = "2xl",
  elevated = true,
  className,
  ...rest
}: Props) {
  return (
    <div
      className={cn(
        "bg-paper-100 border border-paper-200",
        elevated && "shadow-paper",
        pad[padding],
        rad[radius],
        className,
      )}
      {...rest}
    />
  );
}
