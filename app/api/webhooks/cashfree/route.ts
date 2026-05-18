// POST /api/webhooks/cashfree
//
// Cashfree posts here on every payment event for orders we created.
// We only care about PAYMENT_SUCCESS_WEBHOOK for now — that's the
// single state-change we need to grant the subscription.
//
// Security:
//   - Verify the HMAC-SHA256 signature using CASHFREE_WEBHOOK_SECRET.
//   - Reject any request whose signature doesn't validate.
//   - Idempotent: same order_id firing twice (Cashfree retries) is
//     handled by an upsert-like insert with on-conflict-do-nothing.

import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { findStudentPlan } from "@/lib/student-plans";
import { verifyWebhookSignature, fetchOrder } from "@/lib/cashfree";
import { sendCapiEvent } from "@/lib/meta/capi";
import { hashEmail, hashPhone } from "@/lib/meta/hash";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  // Signature first — anything that fails this is dropped silently
  // (200 OK so Cashfree doesn't retry an invalid request).
  let ok = false;
  try {
    ok = verifyWebhookSignature(rawBody, signature, timestamp);
  } catch (e) {
    console.error("[cashfree-webhook] verify error", e);
    return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 500 });
  }
  if (!ok) {
    console.warn("[cashfree-webhook] signature mismatch");
    return NextResponse.json({ ok: false, error: "bad_signature" }, { status: 401 });
  }

  // Parse + handle.
  let event: { type?: string; data?: { order?: { order_id?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const eventType = event.type ?? "";
  const orderIdFromEvent = event.data?.order?.order_id;

  if (eventType !== "PAYMENT_SUCCESS_WEBHOOK" || !orderIdFromEvent) {
    // Acknowledge and move on — we don't act on payment-failed,
    // user-dropped, refund, etc. yet.
    return NextResponse.json({ ok: true, ignored: eventType });
  }

  // Re-fetch the order from Cashfree as the source of truth. The
  // webhook body has the same fields but we trust the API call
  // (signed with our secret key) more than a webhook payload.
  let order;
  try {
    order = await fetchOrder(orderIdFromEvent);
  } catch (e) {
    console.error("[cashfree-webhook] fetchOrder failed", e);
    // 500 so Cashfree retries; the user's status is unresolved.
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }

  if (order.status !== "PAID") {
    return NextResponse.json({ ok: true, status: order.status, action: "noop" });
  }

  const userId = order.customerId;
  const internalPlanId = order.internalPlanId;
  if (!userId || !internalPlanId) {
    console.error("[cashfree-webhook] missing customer_id or plan tag", order);
    return NextResponse.json({ ok: false, error: "incomplete_order" }, { status: 400 });
  }

  // We map every paid student-plan order to the 'student' plan_id
  // on the subscriptions table. The granular id ('school-6-10-all'
  // etc.) is the Cashfree plan label — useful for finance, not for
  // access gating.
  const plan = findStudentPlan(internalPlanId);
  const subPlanId = plan ? "student" : null;
  if (!subPlanId) {
    console.error("[cashfree-webhook] unknown internal plan", internalPlanId);
    return NextResponse.json({ ok: false, error: "unknown_plan" }, { status: 400 });
  }

  const supabase = admin();
  // Idempotent: only insert if there isn't already an active student
  // sub for this user. Avoids piling up duplicate rows on Cashfree
  // retries.
  const { data: existing, error: lookupErr } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_id", subPlanId)
    .eq("status", "active")
    .maybeSingle();
  if (lookupErr) {
    console.error("[cashfree-webhook] subscription lookup error", lookupErr);
    return NextResponse.json({ ok: false, error: "db_lookup" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, action: "already_active", id: existing.id });
  }

  const { error: insertErr } = await supabase
    .from("subscriptions")
    .insert({ user_id: userId, plan_id: subPlanId, status: "active", started_at: new Date().toISOString() });
  if (insertErr) {
    console.error("[cashfree-webhook] subscription insert error", insertErr);
    return NextResponse.json({ ok: false, error: "db_insert" }, { status: 500 });
  }

  // Meta CAPI Purchase. The /payment-success page may also fire a
  // browser-side Pixel Purchase with the same event_id ⇒ Meta dedupes
  // within 48h. If the user closed the tab between Cashfree → return,
  // this server-side event is the only signal that lands.
  void sendCapiEvent({
    eventName: "Purchase",
    eventId: order.orderId,
    eventSourceUrl: `${APP_URL}/payment-success?order_id=${encodeURIComponent(order.orderId)}`,
    userData: {
      em: hashEmail(order.customerEmail) ? [hashEmail(order.customerEmail)!] : undefined,
      ph: hashPhone(order.customerPhone) ? [hashPhone(order.customerPhone)!] : undefined,
      external_id: [userId],
      client_ip_address: clientIp(request),
      client_user_agent: request.headers.get("user-agent") ?? undefined,
      fbp: order.metaTags.fbp ?? undefined,
      fbc: order.metaTags.fbc ?? undefined,
    },
    customData: {
      value: order.amountInr,
      currency: "INR",
      content_ids: [internalPlanId],
      content_type: "product",
    },
  });

  return NextResponse.json({ ok: true, action: "granted" });
}

function clientIp(req: NextRequest): string | undefined {
  // Cashfree's POST comes from their IPs, not the original user — so
  // the IP here only helps match quality if the same browser session
  // also fires the client-side Purchase. Pass it anyway; Meta will
  // weight email + fbp + external_id more.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
