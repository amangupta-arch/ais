"use server";

// /join submit handler.
//
// Public — no auth required to call. The action does the entire
// magic that turns ad-traffic into a signed-in, paying user:
//
//   1. Validate the form input.
//   2. Look up or create the auth.users row by email (admin SDK,
//      so we don't need the user to have signed in first).
//   3. Upsert the profile with the quiz answers.
//   4. Generate a Supabase magic link with redirectTo set to either
//      our checkout starter or our contact-us page. Throwing
//      redirect() at this URL means the user's browser hits
//      Supabase → our /auth/callback → sets cookies → lands on
//      the right next page. They never see a "check your email"
//      screen — auth happens behind the curtains.
//   5. Magic link email still goes out for next-time sign-in.
//
// Errors bounce the user back to /join?error=... with a friendly
// banner. Anything unexpected logs but still surfaces a generic
// "try again" so we never get stuck on a blank page.

import { redirect } from "next/navigation";
import { createClient as createSsrClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";
const SCHOOL_6_TO_10 = new Set(["6", "7", "8", "9", "10"]);

function backToJoin(message: string): never {
  redirect(`/join?error=${encodeURIComponent(message)}`);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function pickString(formData: FormData, key: string, maxLen = 200): string | null {
  const v = formData.get(key);
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLen);
}

function pickAll(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase not configured (URL or SERVICE_ROLE_KEY missing).");
  }
  return createSsrClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function submitQuizAction(formData: FormData) {
  const firstName = pickString(formData, "first_name", 60);
  const email = pickString(formData, "email", 200)?.toLowerCase();
  const city = pickString(formData, "city", 80);
  const schoolClass = pickString(formData, "school_class", 40);
  const educationBoard = pickString(formData, "education_board", 40);
  const boardLanguage = pickString(formData, "board_language", 10);
  const preferredLanguage = pickString(formData, "preferred_language", 10);
  const struggleSubjects = pickAll(formData, "struggle_subjects");

  // Validate first — anything missing means the form was tampered
  // with, since required="" gates it on the browser.
  if (
    !firstName || !email || !city || !schoolClass || !educationBoard ||
    !boardLanguage || !preferredLanguage
  ) {
    backToJoin("Looks like a field went missing. Please try again.");
  }
  if (!isValidEmail(email!)) {
    backToJoin("That email doesn't look right. Try again.");
  }

  // 1 + 2: ensure auth.users row exists for this email.
  // Look up via the profiles table first (the on_auth_user trigger
  // populates profiles.email). If no match, create the auth user;
  // the trigger then inserts the profile row in the same txn.
  const supabase = admin();
  let userId: string;

  {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email!)
      .maybeSingle();

    if (existing?.id) {
      userId = existing.id as string;
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: email!,
        email_confirm: true, // they're proving they own this email via the magic-link redirect
      });
      if (createErr || !created.user) {
        console.error("createUser error", createErr);
        backToJoin("We couldn't create your account. Please try again.");
      }
      userId = created!.user!.id;
    }
  }

  // 3: upsert profile. The trigger on auth.users.insert already
  // populates a base profile row, so this is always an UPDATE.
  {
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        display_name: firstName,
        email,
        city,
        school_class: schoolClass,
        education_board: educationBoard,
        native_language: boardLanguage,
        preferred_language: preferredLanguage,
        struggle_subjects: struggleSubjects,
      })
      .eq("id", userId);
    if (upErr) {
      console.error("profile update error", upErr);
      backToJoin("We couldn't save your answers. Please try again.");
    }
  }

  // 4: pick where to land after auth completes.
  const isSchool6to10 = SCHOOL_6_TO_10.has(schoolClass!);
  const next = isSchool6to10
    ? `/api/checkout/start?plan=school-6-10-all`
    : `/join/contact-us`;
  const redirectTo = `${APP_URL}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: email!,
    options: { redirectTo },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error("generateLink error", linkErr);
    backToJoin("We couldn't start the sign-in process. Please try again.");
  }

  // 5: redirect into Supabase's verify URL → /auth/callback → next.
  redirect(linkData!.properties!.action_link);
}
