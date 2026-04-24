import { cn } from "@/lib/utils";

type Props = {
  number?: string;
  children: React.ReactNode;
  className?: string;
};

export function Eyebrow({ number, children, className }: Props) {
  return (
    <p className={cn("eyebrow", className)}>
      {number ? <><span className="font-tabular">{number}</span> &nbsp; </> : null}
      {children}
    </p>
  );
}
