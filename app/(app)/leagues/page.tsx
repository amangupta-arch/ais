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
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-10">
      <Eyebrow>league</Eyebrow>
      <Display as="h1" size="md" className="mt-2">
        Weekly <em className="italic font-normal">cohorts</em>, coming.
      </Display>
      <p className="mt-4 text-ink-600 leading-relaxed">
        Five learners, same tier, same week. Quiet competition — the kind that actually moves you.
      </p>

      <div className="mt-10 rounded-3xl bg-paper-100 border border-paper-200 p-8 shadow-paper flex items-start gap-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-ember-50 text-ember-600 border border-ember-200 shrink-0">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <p className="font-serif text-xl text-ink-900">Not yet. Soon.</p>
          <p className="mt-2 text-ink-600 leading-relaxed">
            Leagues land after the lesson player does. Build a streak now — when leagues open, you'll already be ahead.
          </p>
        </div>
      </div>
    </main>
  );
}
