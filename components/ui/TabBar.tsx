"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/home",    label: "Today",   icon: Home },
  { href: "/learn",   label: "Explore", icon: Compass },
  { href: "/leagues", label: "League",  icon: Trophy },
  { href: "/profile", label: "You",     icon: User },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-paper-200 bg-paper-50/90 backdrop-blur pb-[max(env(safe-area-inset-bottom),0.5rem)]"
      aria-label="Primary"
    >
      <ul className="mx-auto max-w-2xl grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] tracking-wide transition-colors",
                  active ? "text-ink-900" : "text-ink-500 hover:text-ink-700",
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-ember-500" : "text-ink-500")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
