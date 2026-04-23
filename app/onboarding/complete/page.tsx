"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Display } from "@/components/ui/Display";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { createClient } from "@/lib/supabase/browser";
import { PENDING_KEY, STORAGE_KEY, OnboardingAnswers } from "@/lib/onboarding";

export default function OnboardingCompletePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Writing your plan…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const raw = localStorage.getItem(PENDING_KEY) ?? localStorage.getItem(STORAGE_KEY);
      const answers: OnboardingAnswers = raw ? safeParse(raw) : {};

      const update: Record<string, unknown> = {
        onboarding_completed_at: new Date().toISOString(),
      };
      if (answers.displayName)        update.display_name = answers.displayName.trim();
      if (answers.primaryGoal)        update.primary_goal = answers.primaryGoal;
      if (answers.currentLevel)       update.current_level = answers.currentLevel;
      if (answers.role)               update.role = answers.role;
      if (answers.interests?.length)  update.interests = answers.interests;
      if (answers.preferredLanguage)  update.preferred_language = answers.preferredLanguage;
      if (answers.dailyGoalMinutes)   update.daily_goal_minutes = answers.dailyGoalMinutes;
      if (answers.preferredLanguage === "hi" || answers.preferredLanguage === "hinglish") {
        update.native_language = "hi";
      }

      const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
      if (cancelled) return;

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PENDING_KEY);
      router.replace("/home");
    }

    run().catch((e) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    });

    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="mx-auto max-w-md px-6 pt-24 pb-24 min-h-[100dvh] flex flex-col justify-center">
      <Eyebrow>almost there</Eyebrow>
      {status === "working" ? (
        <Display as="h1" size="md" className="mt-3">
          Setting <em className="italic font-normal">everything</em> up…
        </Display>
      ) : (
        <Display as="h1" size="md" className="mt-3">
          Something went <em className="italic font-normal">sideways</em>.
        </Display>
      )}
      <p className="mt-4 text-ink-600">{message}</p>
    </main>
  );
}

function safeParse(raw: string): OnboardingAnswers {
  try { return JSON.parse(raw) as OnboardingAnswers; } catch { return {}; }
}
