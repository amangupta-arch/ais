"use server";

// Server action invoked from CheckoutCard (client) when the visitor
// clicks "Pay". Creates a Cashfree order and returns the
// payment_session_id + env to the browser, which then invokes
// Cashfree.js v3 (cashfree.checkout({ paymentSessionId, … })) to
// take the visitor to the payment page.
//
// We used to redirect the browser to
// https://payments.cashfree.com/pay/{session_id} directly from a
// server route — that URL works opportunistically but is an internal
// Cashfree endpoint, not a documented integration surface. The JS
// SDK is the only supported path per Cashfree's docs and renders the
// payment method list correctly. Hence this two-step (server creates
// the order, client invokes the SDK).

import { createClient } from "@/lib/supabase/server";
import {
  cashfreeConfigured,
  cashfreeEnv,
  createOrder,
  type CashfreeEnv,
} from "@/lib/cashfree";
import { findStudentPlan } from "@/lib/student-plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";

export type CheckoutSessionResult =
  | {
      ok: true;
      paymentSessionId: string;
      env: CashfreeEnv;
      orderId: string;
    }
  | { ok: false; error: string };

export async function createCheckoutSession({
  planId,
  phone,
}: {
  planId: string;
  phone: string;
}): Promise<CheckoutSessionResult> {
  // Indian mobile: 10 digits, must start 6-9. Cashfree technically
  // accepts the dummy "9999999999" at order-creation time, but UPI
  // handles and acquiring banks reject it at the actual payment
  // step — so we insist on a real number.
  const phoneClean = phone.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phoneClean)) {
    return {
      ok: false,
      error: "Please enter a valid 10-digit Indian mobile number.",
    };
  }

  const plan = findStudentPlan(planId);
  if (!plan) return { ok: false, error: "Unknown plan." };

  if (!cashfreeConfigured()) {
    return {
      ok: false,
      error:
        "Payments aren't live yet. Email hello@myaisetu.com and we'll grant access manually.",
    };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return {
      ok: false,
      error: "Your sign-in expired. Refresh the page and try again.",
    };
  }

  const orderId = `ais-${user.id.replace(/-/g, "").slice(0, 16)}-${Date.now()}`;

  try {
    const order = await createOrder({
      orderId,
      amountInr: plan.priceInr,
      customerId: user.id,
      customerEmail: user.email,
      customerPhone: phoneClean,
      // Cashfree substitutes {order_id} server-side, do not URL-encode.
      returnUrl: `${APP_URL}/payment-success?order_id={order_id}`,
      notifyUrl: `${APP_URL}/api/webhooks/cashfree`,
      note: `${plan.label} (${plan.id})`,
      internalPlanId: plan.id,
    });
    return {
      ok: true,
      paymentSessionId: order.paymentSessionId,
      env: cashfreeEnv(),
      orderId: order.orderId,
    };
  } catch (e) {
    // createOrder() embeds status + env + API version + body into
    // the message — keep it as a string so Vercel logs don't
    // truncate it to "[Object]".
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[students-plan/createCheckoutSession] createOrder failed:", msg);
    return {
      ok: false,
      error:
        "We couldn't reach the payment gateway. Try again in a minute, or email hello@myaisetu.com.",
    };
  }
}
