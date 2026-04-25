"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <main className="lm-page flex flex-col justify-center">
      <div
        className="mx-auto"
        style={{ maxWidth: 440, padding: "96px 24px" }}
      >
        <p className="lm-eyebrow">almost there</p>
        <h1
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 32, lineHeight: 1.15, color: "var(--text)" }}
        >
          {status === "working"
            ? "Setting everything up…"
            : "Something went sideways."}
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 15,
            lineHeight: 1.65,
            color: status === "error" ? "var(--coral-deep)" : "var(--text-2)",
          }}
        >
          {message}
        </p>
      </div>
    </main>
  );
}

function safeParse(raw: string): OnboardingAnswers {
  try { return JSON.parse(raw) as OnboardingAnswers; } catch { return {}; }
}
