import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { getMe } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const { user } = await getMe();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-10">
      <Eyebrow>league</Eyebrow>
      <Display as="h1" size="md" className="mt-2">Weekly cohorts, coming.</Display>
      <p className="mt-3 text-ink-700 leading-relaxed">
        Five learners, same tier, same week. Quiet competition — the kind that actually moves you.
      </p>

      <div className="mt-8 rounded-lg bg-white border border-ink-200 p-6 flex items-start gap-4">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-50 text-accent-700 border border-accent-200 shrink-0">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-lg text-ink-900">Not yet. Soon.</p>
          <p className="mt-1 text-ink-700 leading-relaxed">
            Leagues land after the lesson player does. Build a streak now — when leagues open, you'll already be ahead.
          </p>
        </div>
      </div>
    </main>
  );
}
