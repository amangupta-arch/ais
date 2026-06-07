"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Only these columns are writable through the profile-edit UI.
// updateProfile() accepts a Record<string, unknown> from the client,
// and without this allowlist a crafted server-action call could
// overwrite the user's own email, onboarding_completed_at, signup
// quiz answers, school_path, etc. — bypassing input validation and
// corrupting analytics/funnel data. Add to this set only when a UI
// genuinely needs to write the field. Don't add `email` — Supabase
// owns that via auth.users.
const PROFILE_PATCH_ALLOWED_KEYS = new Set<string>([
  "daily_goal_minutes",
  "preferred_language",
  "display_name",
  "avatar_url",
]);

export async function updateProfile(patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Pick only allowlisted keys. Anything else (including arbitrary
  // attacker-supplied columns) is silently dropped; the action does
  // not throw so the legitimate UI flow isn't broken by a stale
  // form field, but a forged patch can no longer write rows it
  // wasn't authorized to touch.
  const safePatch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (PROFILE_PATCH_ALLOWED_KEYS.has(k)) safePatch[k] = v;
  }
  if (Object.keys(safePatch).length === 0) return;

  await supabase.from("profiles").update(safePatch).eq("id", user.id);
  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/learn");
  revalidatePath("/student");
}
