// Thin Cashfree Payment Gateway client. We hit the REST API
// directly via fetch instead of pulling in the cashfree-pg SDK —
// the surface we use (create order + verify order + webhook
// signature) is small, and avoiding the dep keeps the bundle
// trimmer and gives us full control over error handling.
//
// Env vars:
//   CASHFREE_APP_ID          — required
//   CASHFREE_SECRET_KEY      — required (kept server-side)
//   CASHFREE_WEBHOOK_SECRET  — required for webhook verification
//   CASHFREE_ENV             — 'SANDBOX' (default) or 'PRODUCTION'
//
// Until creds are set, every entry point returns a typed
// "not configured" error so the funnel surface can show a polite
// message instead of crashing.

import { createHmac } from "node:crypto";

const API_VERSION = "2025-01-01";

export type CashfreeEnv = "SANDBOX" | "PRODUCTION";

export function cashfreeEnv(): CashfreeEnv {
  return process.env.CASHFREE_ENV === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";
}

export function cashfreeApiBase(): string {
  return cashfreeEnv() === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export function cashfreeConfigured(): boolean {
  return Boolean(
    process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY,
  );
}

function requiredHeaders(): Record<string, string> {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) {
    throw new Error("Cashfree not configured — set CASHFREE_APP_ID + CASHFREE_SECRET_KEY.");
  }
  return {
    "x-client-id": id,
    "x-client-secret": secret,
    "x-api-version": API_VERSION,
    "content-type": "application/json",
    accept: "application/json",
  };
}

export type CreateOrderArgs = {
  /** Stable string ID we generate; Cashfree wants ≤45 alphanum/-_/. */
  orderId: string;
  amountInr: number;
  /** auth.users.id — round-trips via order.customer_details.customer_id
   *  so the webhook can grant the right user's subscription. */
  customerId: string;
  customerEmail: string;
  /** Cashfree requires a 10-digit phone or "9999999999" placeholder.
   *  We don't collect phone in the quiz, so use the placeholder. */
  customerPhone?: string;
  /** Absolute URL Cashfree redirects the user to after payment. */
  returnUrl: string;
  /** Absolute URL Cashfree POSTs the webhook to. */
  notifyUrl: string;
  /** Free-form note that shows up in the Cashfree dashboard. */
  note?: string;
  /** Round-tripped via order_meta so /payment-success knows which
   *  internal plan slug this order was for. */
  internalPlanId: string;
  /** Meta browser-side identifiers captured at checkout-start. Travel
   *  via order_tags so the webhook can attribute the Purchase even
   *  when the user's browser never lands on /payment-success.
   *  Cashfree caps order_tags values at 255 chars; fbp/fbc are
   *  comfortably under that. */
  metaTags?: {
    fbp?: string;
    fbc?: string;
  };
};

export type CreateOrderResult = {
  orderId: string;
  /** Pass this to Cashfree.js v3 in the browser:
   *    cashfree.checkout({ paymentSessionId, redirectTarget: '_self' })
   *  We don't build a hosted-checkout URL here — Cashfree's direct
   *  /pay/{session_id} URL is an internal endpoint, not a public
   *  integration surface. The JS SDK is the supported path. */
  paymentSessionId: string;
};

export async function createOrder(args: CreateOrderArgs): Promise<CreateOrderResult> {
  const res = await fetch(`${cashfreeApiBase()}/orders`, {
    method: "POST",
    headers: requiredHeaders(),
    body: JSON.stringify({
      order_id: args.orderId,
      order_amount: args.amountInr,
      order_currency: "INR",
      customer_details: {
        customer_id: args.customerId,
        customer_email: args.customerEmail,
        customer_phone: args.customerPhone ?? "9999999999",
      },
      order_note: args.note,
      order_meta: {
        return_url: args.returnUrl,
        notify_url: args.notifyUrl,
        // Cashfree returns the meta back in the order-fetch response;
        // we use it to recover the internal plan slug post-payment.
        payment_methods: undefined, // accept everything
      },
      order_tags: {
        plan_id: args.internalPlanId,
        ...(args.metaTags?.fbp ? { fb_fbp: args.metaTags.fbp } : {}),
        ...(args.metaTags?.fbc ? { fb_fbc: args.metaTags.fbc } : {}),
      },
    }),
  });

  const body = await res.json();
  if (!res.ok || !body.payment_session_id) {
    // Embed env + API version + response body into the message so
    // Vercel logs surface *why* Cashfree rejected the order
    // (sandbox-vs-prod mismatch, x-api-version drift, invalid phone
    // placeholder, etc.) without us having to re-deploy with extra
    // logging.
    const detail =
      body && typeof body === "object" ? JSON.stringify(body) : String(body);
    throw new Error(
      `Cashfree createOrder ${res.status} ${res.statusText} — env=${cashfreeEnv()} api=${API_VERSION} body=${detail.slice(0, 800)}`,
    );
  }

  return {
    orderId: body.order_id,
    paymentSessionId: body.payment_session_id,
  };
}

export type OrderStatus = {
  orderId: string;
  /** Cashfree statuses: ACTIVE / PAID / EXPIRED / TERMINATED / TERMINATION_REQUESTED */
  status: string;
  amountInr: number;
  customerId: string;
  customerEmail: string;
  customerPhone: string;
  internalPlanId: string | null;
  /** Meta browser-side identifiers as stashed at order-create time.
   *  Empty when the visitor had no Pixel cookies (ad blocker, first
   *  visit, etc.) — CAPI matches on email + external_id in that case. */
  metaTags: {
    fbp: string | null;
    fbc: string | null;
  };
};

export async function fetchOrder(orderId: string): Promise<OrderStatus> {
  const res = await fetch(`${cashfreeApiBase()}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
    headers: requiredHeaders(),
  });
  const body = await res.json();
  if (!res.ok || !body.order_id) {
    throw new Error(
      `Cashfree fetchOrder failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }
  return {
    orderId: body.order_id,
    status: body.order_status,
    amountInr: Number(body.order_amount ?? 0),
    customerId: body.customer_details?.customer_id ?? "",
    customerEmail: body.customer_details?.customer_email ?? "",
    customerPhone: body.customer_details?.customer_phone ?? "",
    internalPlanId: body.order_tags?.plan_id ?? null,
    metaTags: {
      fbp: body.order_tags?.fb_fbp ?? null,
      fbc: body.order_tags?.fb_fbc ?? null,
    },
  };
}

/** Reject webhooks whose timestamp is more than this many seconds
 *  away from "now". HMAC verification alone doesn't bound replay:
 *  a captured signed body (e.g. from a leaked log) stays valid
 *  forever otherwise. 5 minutes is the industry-standard window
 *  (Stripe / Slack / Cashfree's own integration guides), wide
 *  enough to absorb clock skew + a slow retry, tight enough that
 *  an attacker can't replay an old PAID body to resurrect a
 *  cancelled subscription. */
const WEBHOOK_FRESHNESS_WINDOW_SEC = 5 * 60;

/** Verify a Cashfree webhook. Per their docs the signature is
 *  HMAC-SHA256(secret, timestamp + body). We get the raw body
 *  (Buffer-style string) and the two header values.
 *
 *  We try CASHFREE_WEBHOOK_SECRET first, then fall back to
 *  CASHFREE_SECRET_KEY. Cashfree's docs treat the webhook secret as
 *  separate, but several accounts sign webhooks with the API client
 *  secret instead — accepting either means we don't have to know
 *  which mode the account is in.
 *
 *  Returns true if either candidate matches AND the timestamp is
 *  within WEBHOOK_FRESHNESS_WINDOW_SEC of now. Throws if neither
 *  secret env var is set — that means we forgot to wire prod
 *  correctly and we'd rather fail loudly than silently accept
 *  unverified webhooks. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  const candidates = [
    process.env.CASHFREE_WEBHOOK_SECRET,
    process.env.CASHFREE_SECRET_KEY,
  ].filter((s): s is string => Boolean(s));
  if (candidates.length === 0) {
    throw new Error(
      "Neither CASHFREE_WEBHOOK_SECRET nor CASHFREE_SECRET_KEY is configured.",
    );
  }
  if (!signatureHeader || !timestampHeader) return false;

  // Reject replays of an old signed body before doing crypto.
  // Cashfree sends timestamp as an epoch-seconds string. NaN /
  // negative / non-finite values fall through to the rejection.
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const skewSec = Math.abs(Date.now() / 1000 - ts);
  if (skewSec > WEBHOOK_FRESHNESS_WINDOW_SEC) return false;

  for (const secret of candidates) {
    const expected = createHmac("sha256", secret)
      .update(timestampHeader + rawBody)
      .digest("base64");
    if (constantTimeEqual(expected, signatureHeader)) return true;
  }
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
