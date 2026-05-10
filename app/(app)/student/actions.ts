"use server";

// Server actions for the /student dashboard. Today there's just one:
// the inline class picker. Lives in its own file so the page can stay
// a server component without dragging "use server" into the markup.

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function setSchoolClassAction(formData: FormData) {
  const raw = formData.get("school_class");
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 12) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ school_class: n }).eq("id", user.id);
  revalidatePath("/student");
  revalidatePath("/profile");
}
