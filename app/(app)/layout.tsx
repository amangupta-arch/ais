"use client";

import { usePathname } from "next/navigation";
import { TabBar } from "@/components/ui/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  // Lesson view (/learn/<course>/<lesson>) owns the full viewport — the
  // player is height-locked to 100dvh, so a bottom tab bar + pb-20 spacer
  // would either push content below the fold or leave 80 px of body to
  // scroll under the locked area. Drop both on lesson routes only.
  const inLesson = /^\/learn\/[^/]+\/[^/]+/.test(path);
  return (
    <>
      <div className={inLesson ? undefined : "pb-20"}>{children}</div>
      {inLesson ? null : <TabBar />}
    </>
  );
}
