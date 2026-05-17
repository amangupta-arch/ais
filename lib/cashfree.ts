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

export function cashfreeCheckoutBase(): string {
  return cashfreeEnv() === "PRODUCTION"
    ? "https://payments.cashfree.com/pay"
    : "https://payments-test.cashfree.com/pay";
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
};

export type CreateOrderResult = {
  orderId: string;
  paymentSessionId: string;
  hostedCheckoutUrl: string;
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
      },
    }),
  });

  const body = await res.json();
  if (!res.ok || !body.payment_session_id) {
    throw new Error(
      `Cashfree createOrder failed (${res.status}): ${JSON.stringify(body)}`,
    );
  }

  return {
    orderId: body.order_id,
    paymentSessionId: body.payment_session_id,
    hostedCheckoutUrl: `${cashfreeCheckoutBase()}/${body.payment_session_id}`,
  };
}

export type OrderStatus = {
  orderId: string;
  /** Cashfree statuses: ACTIVE / PAID / EXPIRED / TERMINATED / TERMINATION_REQUESTED */
  status: string;
  amountInr: number;
  customerId: string;
  customerEmail: string;
  internalPlanId: string | null;
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
    internalPlanId: body.order_tags?.plan_id ?? null,
  };
}

/** Verify a Cashfree webhook. Per their docs the signature is
 *  HMAC-SHA256(secret, timestamp + body). We get the raw body
 *  (Buffer-style string) and the two header values.
 *
 *  Returns true if the signature matches. Throws if the webhook
 *  secret env var is missing — that means we forgot to wire prod
 *  correctly and we'd rather fail loudly than silently accept
 *  unverified webhooks. */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
): boolean {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("CASHFREE_WEBHOOK_SECRET is not configured.");
  }
  if (!signatureHeader || !timestampHeader) return false;

  const expected = createHmac("sha256", secret)
    .update(timestampHeader + rawBody)
    .digest("base64");

  // Constant-time compare in case Node 24 drops the leniency.
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}
