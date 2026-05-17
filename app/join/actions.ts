"use server";

// Server actions for the /join funnel.
//
// Two entry points:
//
//   createUserWithEmailAction(formData)
//     — invoked from the sign-in step's email form.
//     — Creates the auth.users row if missing.
//     — Generates a Supabase magic link with redirectTo =
//       /auth/callback?next=<form's `next` value>.
//     — Redirects the browser to the magic link so the user
//       lands signed-in on the next route (defaults to
//       /join/finalize).
//
//   applyPendingQuiz(quizData)
//     — invoked from the /join/finalize client page AFTER the
//       user is signed in (Google or email magic link).
//     — Writes the quiz fields onto profiles for the current
//       user. Returns the routing decision (checkout for class
//       6–10, otherwise contact-us).
//
// We DON'T save the quiz data in createUserWithEmailAction —
// that runs without the user's session yet, and we'd rather
// have all the profile-write logic live in one place
// (applyPendingQuiz) than risk drift between two writers.

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";
const SCHOOL_6_TO_10 = new Set(["6", "7", "8", "9", "10"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase not configured (URL or SERVICE_ROLE_KEY missing).");
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function backToJoin(message: string): never {
  redirect(`/join?error=${encodeURIComponent(message)}`);
}

// ─── 1) Email sign-in (creates auth user, redirects to magic link) ──

export async function createUserWithEmailAction(formData: FormData) {
  const emailRaw = formData.get("email");
  const nextRaw = formData.get("next");
  const email =
    typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/")
      ? nextRaw
      : "/join/finalize";

  if (!email || !isValidEmail(email)) {
    backToJoin("That email doesn't look right. Try again.");
  }

  const supabase = admin();

  // Look up via profiles (populated by the auth.users insert trigger).
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!existing) {
    const { error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (createErr) {
      console.error("createUser error", createErr);
      backToJoin("We couldn't create your account. Please try again.");
    }
  }

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error("generateLink error", linkErr);
    backToJoin("We couldn't start the sign-in process. Please try again.");
  }

  redirect(linkData!.properties!.action_link);
}

// ─── 2) Apply pending quiz to the signed-in user's profile ─────────

export type PendingQuiz = {
  firstName?: string;
  city?: string;
  schoolClass?: string;
  educationBoard?: string;
  boardLanguage?: string;
  preferredLanguage?: string;
  struggleSubjects?: string[];
};

export type ApplyResult =
  | { ok: true; redirectTo: string }
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
  if (quiz.educationBoard) patch.education_board = quiz.educationBoard;
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

  return { ok: true, redirectTo };
}
