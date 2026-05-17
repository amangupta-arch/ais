// GET /api/checkout/start?plan=<id>
//
// Creates a Cashfree order for the signed-in user's chosen plan
// and redirects them to Cashfree's hosted checkout. Called as the
// `next` of the auth-callback round-trip from /join/actions.ts,
// so by the time we get here the user is signed in and we can
// read their auth.users row.
//
// Order ID format: `ais-<user_id_short>-<timestamp_ms>`. Short
// enough for Cashfree's 45-char limit, unique enough that retries
// don't collide.

import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { cashfreeConfigured, createOrder } from "@/lib/cashfree";
import { findStudentPlan } from "@/lib/student-plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const planId = url.searchParams.get("plan");

  if (!planId) {
    return NextResponse.redirect(new URL("/join?error=Missing+plan", APP_URL));
  }

  const plan = findStudentPlan(planId);
  if (!plan) {
    return NextResponse.redirect(
      new URL(`/join?error=${encodeURIComponent("Unknown plan: " + planId)}`, APP_URL),
    );
  }

  // The user is signed in by now (auth-callback ran before us).
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/join?error=Please+restart+the+quiz", APP_URL));
  }

  if (!cashfreeConfigured()) {
    return NextResponse.redirect(
      new URL(
        `/join?error=${encodeURIComponent(
          "Payments aren't live yet. Email hello@myaisetu.com and we'll grant you access.",
        )}`,
        APP_URL,
      ),
    );
  }

  // Stable-ish but unique enough order id.
  const orderId = `ais-${user.id.replace(/-/g, "").slice(0, 16)}-${Date.now()}`;

  try {
    const order = await createOrder({
      orderId,
      amountInr: plan.priceInr,
      customerId: user.id,
      customerEmail: user.email,
      returnUrl: `${APP_URL}/payment-success?order_id={order_id}`,
      notifyUrl: `${APP_URL}/api/webhooks/cashfree`,
      note: `${plan.label} (${plan.id})`,
      internalPlanId: plan.id,
    });
    return NextResponse.redirect(order.hostedCheckoutUrl);
  } catch (e) {
    console.error("Cashfree createOrder failed", e);
    return NextResponse.redirect(
      new URL(
        `/join?error=${encodeURIComponent(
          "We couldn't reach the payment gateway. Try again in a minute.",
        )}`,
        APP_URL,
      ),
    );
  }
}
