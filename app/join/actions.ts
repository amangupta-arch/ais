"use server";

// Server action for the /join funnel.
//
// applyPendingQuiz(quizData)
//   — invoked from the /join/finalize client page AFTER the user
//     is signed in (Google / email+password / phone+OTP).
//   — Writes the quiz fields onto profiles for the current user.
//   — Returns the routing decision (checkout for class 6–10,
//     otherwise contact-us).
//
// Magic-link sign-in was removed. /join now uses Google OAuth,
// email + password, and phone + OTP. All three deposit the user
// at /join/finalize, which calls this action.

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { sendCapiEvent } from "@/lib/meta/capi";
import { hashEmail } from "@/lib/meta/hash";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";
const SCHOOL_6_TO_10 = new Set(["6", "7", "8", "9", "10"]);

export type PendingQuiz = {
  firstName?: string;
  city?: string;
  schoolClass?: string;
  educationBoard?: string;
  stateBoard?: string;
  boardLanguage?: string;
  preferredLanguage?: string;
  struggleSubjects?: string[];
};

export type ApplyResult =
  | {
      ok: true;
      redirectTo: string;
      // Returned so the client can fire the Pixel Lead + CompleteRegistration
      // partners with matching event_ids → Meta dedupes browser vs server.
      leadEventId: string;
      registrationEventId: string;
    }
  | { ok: false; error: string };

export async function applyPendingQuiz(quiz: PendingQuiz): Promise<ApplyResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not-signed-in" };

  const patch: Record<string, unknown> = {};
  const firstName = quiz.firstName?.trim().slice(0, 60);
  if (firstName) {
    patch.first_name = firstName;
    patch.display_name = firstName;
  }
  if (quiz.city) patch.city = quiz.city.trim().slice(0, 80);
  if (quiz.schoolClass) patch.school_class = quiz.schoolClass;
  if (quiz.educationBoard) {
    patch.education_board = quiz.educationBoard;
    // state_board is only meaningful when board === 'state'; clear
    // it otherwise so a re-pick from CBSE → ICSE doesn't leave a
    // stale "maharashtra" on the row.
    patch.state_board =
      quiz.educationBoard === "state" && quiz.stateBoard ? quiz.stateBoard : null;
  }
  if (quiz.boardLanguage) patch.native_language = quiz.boardLanguage;
  if (quiz.preferredLanguage) patch.preferred_language = quiz.preferredLanguage;
  if (Array.isArray(quiz.struggleSubjects)) {
    patch.struggle_subjects = quiz.struggleSubjects.filter(
      (s): s is string => typeof s === "string",
    );
  }
  // The join quiz IS the onboarding for these users — they've answered
  // class, board, medium, preferred language, struggle subjects. Mark
  // it complete so /home doesn't bounce them to /onboarding (the
  // legacy 7-step flow) when they navigate there later.
  //
  // Gate on quiz.schoolClass: if localStorage was empty when the
  // visitor hit /join/finalize, the quiz payload is `{}` and we have
  // nothing to claim as onboarding. Leaving onboarding_completed_at
  // null in that case keeps /home's bounce-to-/onboarding behaviour
  // for genuinely empty profiles.
  if (quiz.schoolClass) {
    patch.onboarding_completed_at = new Date().toISOString();
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      console.error("applyPendingQuiz update error", error);
      return { ok: false, error: "save-failed" };
    }
  }

  // Prefer the quiz value (it's what the user just answered) but
  // fall back to whatever's already on profile in case the quiz
  // data was lost in transit.
  let cls = quiz.schoolClass;
  if (!cls) {
    const { data: p } = await supabase
      .from("profiles")
      .select("school_class")
      .eq("id", user.id)
      .maybeSingle();
    cls = p?.school_class ?? undefined;
  }

  // Class 6-10 → /students-plan, the explicit offer checkpoint. The
  // visitor clicks "Pay" there to start Cashfree; we no longer chain
  // sign-up silently into a payment gateway. Other classes still get
  // the "thanks, not live yet" page.
  const redirectTo =
    cls && SCHOOL_6_TO_10.has(cls)
      ? `/students-plan`
      : `/join/contact-us`;

  // Meta CAPI Lead + CompleteRegistration. event_ids are derived from
  // user_id so re-running applyPendingQuiz (e.g., the user reloads
  // /join/finalize) doesn't double-count.
  const leadEventId = `lead-${user.id}`;
  const registrationEventId = `reg-${user.id}`;
  const h = await headers();
  const userData = {
    em: user.email && hashEmail(user.email) ? [hashEmail(user.email)!] : undefined,
    external_id: [user.id],
    client_ip_address: clientIp(h),
    client_user_agent: h.get("user-agent") ?? undefined,
  };
  void sendCapiEvent({
    eventName: "Lead",
    eventId: leadEventId,
    eventSourceUrl: `${APP_URL}/join/finalize`,
    userData,
    customData: { content_category: cls ?? undefined },
  });
  void sendCapiEvent({
    eventName: "CompleteRegistration",
    eventId: registrationEventId,
    eventSourceUrl: `${APP_URL}/join/finalize`,
    userData,
    customData: { content_name: "ais-signup" },
  });

  return { ok: true, redirectTo, leadEventId, registrationEventId };
}

function clientIp(h: Headers): string | undefined {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? undefined;
}
