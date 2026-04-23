"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "ember" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
};

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-medium rounded-full " +
  "transition-[transform,box-shadow,background-color,color] duration-220 ease-warm " +
  "active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper-50";

const variants: Record<Variant, string> = {
  ember:
    "bg-ember-500 text-paper-50 shadow-ember hover:bg-ember-600 hover:shadow-[0_10px_28px_rgba(242,106,23,0.22)]",
  ghost:
    "bg-transparent text-ink-800 hover:bg-paper-200",
  outline:
    "bg-transparent text-ink-900 border border-ink-200 hover:border-ink-300 hover:bg-paper-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9  px-4   text-sm",
  md: "h-11 px-6   text-[15px]",
  lg: "h-14 px-8   text-base",
};

export function Button({
  variant = "ember",
  size = "md",
  fullWidth,
  className,
  ...rest
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    />
  );
}

export function ButtonLink({
  href,
  variant = "ember",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
