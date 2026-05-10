"use server";

// Single integration point for Cashfree. Today this is a stub —
// it validates the plan and redirects to /checkout with the plan
// in the URL so the user sees a "coming soon" page that names
// what they tried to buy.
//
// To wire Cashfree Subscriptions later, replace the body of
// startCheckout() with:
//
//   1. Look up the Cashfree plan_id mapped to the internal plan id
//      (we'll store the mapping in a CASHFREE_PLAN_IDS object).
//   2. Call Cashfree's POST /pg/subscriptions to create a sub for
//      the signed-in user. Pass return_url = absolute URL of
//      /checkout/success and let Cashfree handle the rest.
//   3. redirect() to the authorisation URL Cashfree returns.
//   4. Add /api/webhooks/cashfree route to flip the user's
//      subscription row to status='active' on PAYMENT_SUCCESS.
//
// Sign-in gating: the plan pages are public so anyone can click
// Subscribe. When real checkout exists, this action should
// redirect anonymous visitors to /login?next=/checkout?plan=<id>
// before kicking off the Cashfree flow.

import { redirect } from "next/navigation";

import { findStudentPlan } from "@/lib/student-plans";

export async function startCheckout(formData: FormData) {
  const planId = formData.get("plan_id");
  if (typeof planId !== "string" || !planId) {
    redirect("/checkout?error=missing_plan");
  }
  const plan = findStudentPlan(planId);
  if (!plan) {
    redirect("/checkout?error=unknown_plan");
  }
  // TODO(cashfree): create subscription via Cashfree API, redirect to
  // the auth URL it returns. Today, just bounce to the placeholder.
  redirect(`/checkout?plan=${encodeURIComponent(planId)}`);
}
