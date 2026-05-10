"use server";

// Server actions for the /student dashboard.
//
// One action — setSchoolPathAction — sets institute + school_class
// together because they're meaningful only as a pair:
//   - K-12 path: institute = null, school_class = '10'
//   - NMIMS BBA: institute = 'nmims', school_class = 'bba-sem-01'
// The picker UI submits both fields per choice (one form per option).

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

export async function setSchoolPathAction(formData: FormData) {
  const rawInstitute = formData.get("institute");
  const rawClass = formData.get("school_class");

  // Empty / "null" string from a form means "K-12, no institute".
  const institute =
    typeof rawInstitute === "string" && rawInstitute.length > 0 ? rawInstitute : null;
  const schoolClass = typeof rawClass === "string" ? rawClass : "";

  if (!SLUG_PATTERN.test(schoolClass)) return;
  if (institute !== null && !SLUG_PATTERN.test(institute)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ institute, school_class: schoolClass })
    .eq("id", user.id);
  revalidatePath("/student");
  revalidatePath("/profile");
}
