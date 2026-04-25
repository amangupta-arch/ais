"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, User } from "lucide-react";

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
      className="fixed bottom-0 inset-x-0 z-20"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "max(env(safe-area-inset-bottom), 4px)",
      }}
      aria-label="Primary"
    >
      <ul className="mx-auto grid grid-cols-4" style={{ maxWidth: 640 }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col items-center justify-center"
                style={{
                  gap: 4,
                  padding: "10px 4px",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  color: active ? "var(--indigo-deep)" : "var(--text-3)",
                  fontWeight: active ? 600 : 500,
                  textDecoration: "none",
                  transition: "color 160ms cubic-bezier(0.2, 0, 0, 1)",
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: active ? "var(--indigo)" : "var(--text-3)" }}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
