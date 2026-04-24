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
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-10">
      <Eyebrow>you</Eyebrow>
      <Display as="h1" size="md" className="mt-2">
        {profile?.display_name ?? user.email ?? "Your profile"}
      </Display>
      {user.email ? <p className="mt-1 text-ink-500 text-sm font-tabular">{user.email}</p> : null}

      <section className="mt-8 rounded-lg bg-white border border-ink-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>plan</Eyebrow>
            <p className="mt-1.5 font-semibold text-2xl text-ink-900">{plan?.name ?? formatTier(tier)}</p>
            {plan?.tagline ? <p className="mt-0.5 text-ink-600">{plan.tagline}</p> : null}
          </div>
          <Link href="/learn" className="text-sm text-ink-600 hover:text-ink-900 underline transition-colors duration-150 ease-out">
            See catalogue
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow number="01">Your tutor</Eyebrow>
        <p className="mt-1.5 text-ink-500 text-sm">Pick the voice that'll push you best.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PERSONAS.map((p) => (
            <form key={p.id} action={updateTutorAction}>
              <input type="hidden" name="persona" value={p.id} />
              <button
                type="submit"
                className={`w-full text-left rounded-md border p-4 flex items-start gap-3 transition-[border-color,background-color] duration-150 ease-out ${
                  currentPersona === p.id
                    ? "border-accent-600 bg-accent-50"
                    : "border-ink-200 bg-white hover:border-ink-300"
                }`}
              >
                <TutorAvatar personaId={p.id} size="md" />
                <div>
                  <p className="font-semibold text-[15px] text-ink-900">
                    {p.name} — <span className="font-normal text-ink-700">{p.tagline}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-600">{p.blurb}</p>
                </div>
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow number="02">Daily protected time</Eyebrow>
        <form action={updateDailyGoalAction} className="mt-2 flex gap-2 flex-wrap">
          {[5, 10, 20, 30].map((m) => {
            const active = (profile?.daily_goal_minutes ?? 10) === m;
            return (
              <button
                key={m}
                type="submit"
                name="minutes"
                value={m}
                className={`rounded-md px-4 h-10 border text-[14px] transition-colors duration-150 ease-out ${
                  active
                    ? "bg-accent-600 text-white border-accent-600"
                    : "bg-white border-ink-300 text-ink-700 hover:border-ink-400"
                }`}
              >
                <span className="font-tabular font-semibold">{m}</span> min
              </button>
            );
          })}
        </form>
      </section>

      <section className="mt-12 border-t border-ink-200 pt-6">
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-ink-600 hover:text-danger-700 underline transition-colors duration-150 ease-out"
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
