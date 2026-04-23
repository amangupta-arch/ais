import { redirect } from "next/navigation";
import Link from "next/link";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TutorAvatar } from "@/components/ui/TutorAvatar";

import { getMe, getPlans } from "@/lib/supabase/queries";
import { PERSONAS } from "@/lib/types";
import { signOutAction } from "./actions";
import { formatTier } from "@/lib/utils";
import type { Persona, PlanTier } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile, planId } = await getMe();
  if (!user) redirect("/login");

  const plans = await getPlans();
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const currentPersona: Persona["id"] = (profile?.preferred_tutor_persona as Persona["id"]) ?? "nova";
  const tier: PlanTier = (planId as PlanTier) ?? "free";

  return (
    <main className="mx-auto max-w-2xl px-5 pt-8 pb-10">
      <Eyebrow>you</Eyebrow>
      <Display as="h1" size="md" className="mt-2">
        {profile?.display_name ?? user.email ?? "Your profile"}
      </Display>
      {user.email ? <p className="mt-1 text-ink-500 text-sm font-tabular">{user.email}</p> : null}

      <section className="mt-8 rounded-3xl bg-paper-100 border border-paper-200 p-6 shadow-paper">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>plan</Eyebrow>
            <p className="mt-2 font-serif text-2xl text-ink-900">{plan?.name ?? formatTier(tier)}</p>
            {plan?.tagline ? (
              <p className="mt-1 text-ink-500 italic font-serif">{plan.tagline}</p>
            ) : null}
          </div>
          <Link href="/learn" className="text-sm text-ink-600 hover:text-ink-900 underline">See catalogue</Link>
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow number="01">Your tutor</Eyebrow>
        <p className="mt-2 text-ink-500 text-sm">Pick the voice that'll push you best.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PERSONAS.map((p) => (
            <form key={p.id} action={updateTutorAction}>
              <input type="hidden" name="persona" value={p.id} />
              <button
                type="submit"
                className={`w-full text-left rounded-2xl border p-5 flex items-start gap-4 transition-[transform,border-color,background-color] duration-220 ease-warm hover:-translate-y-[2px] ${currentPersona === p.id ? "border-ember-500 bg-ember-50" : "border-paper-200 bg-paper-100 hover:border-ink-200"}`}
              >
                <TutorAvatar personaId={p.id} size="lg" />
                <div>
                  <p className="font-serif text-lg text-ink-900">
                    {p.name} — <em className="italic font-normal">{p.tagline}</em>
                  </p>
                  <p className="mt-1 text-sm text-ink-500">{p.blurb}</p>
                </div>
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow number="02">Daily protected time</Eyebrow>
        <form action={updateDailyGoalAction} className="mt-3 flex gap-3 flex-wrap">
          {[5, 10, 20, 30].map((m) => {
            const active = (profile?.daily_goal_minutes ?? 10) === m;
            return (
              <button
                key={m}
                type="submit"
                name="minutes"
                value={m}
                className={`rounded-full px-5 h-11 border text-[15px] transition-colors ${active ? "bg-ember-500 text-paper-50 border-ember-500" : "bg-paper-100 border-paper-200 text-ink-700 hover:border-ink-300"}`}
              >
                <span className="font-tabular">{m}</span> min
              </button>
            );
          })}
        </form>
      </section>

      <section className="mt-12 border-t border-paper-200 pt-8">
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-ink-600 hover:text-ember-700 transition-colors underline"
          >
            sign out
          </button>
        </form>
      </section>
    </main>
  );
}

async function updateTutorAction(formData: FormData) {
  "use server";
  const { updateProfile } = await import("./actions");
  const persona = formData.get("persona");
  if (typeof persona !== "string") return;
  await updateProfile({ preferred_tutor_persona: persona });
}

async function updateDailyGoalAction(formData: FormData) {
  "use server";
  const { updateProfile } = await import("./actions");
  const minutes = Number(formData.get("minutes"));
  if (!Number.isFinite(minutes)) return;
  await updateProfile({ daily_goal_minutes: minutes });
}
