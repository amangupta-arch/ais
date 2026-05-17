// /payment-success?order_id=<id>
//
// Cashfree return_url for the funnel checkout. The user lands
// here right after paying (or right after cancelling — same URL).
// We verify the order's status via the Cashfree API, grant the
// subscription if it's PAID and the webhook hasn't already done
// it (defence in depth), then push them to /home.
//
// We can't rely on the webhook alone because the user's browser
// is racing it — they often land here BEFORE Cashfree's POST
// completes. So this page does the same insert-if-missing
// pattern.

import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import Link from "next/link";

import "@/app/landing.css";
import { fetchOrder } from "@/lib/cashfree";
import { findStudentPlan } from "@/lib/student-plans";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string }>;
}) {
  const { order_id: orderId } = await searchParams;
  if (!orderId) {
    return <Layout status="missing" />;
  }

  // The user is signed in (we set cookies via auth-callback before
  // sending them to Cashfree). Read who they are first; if they're
  // not signed in (cookies dropped, returned in a different
  // browser), we still verify the order and tell them what
  // happened — they'll need to sign in via magic-link manually.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify the order with Cashfree as the source of truth.
  let order;
  try {
    order = await fetchOrder(orderId);
  } catch (e) {
    console.error("[payment-success] fetchOrder failed", e);
    return <Layout status="error" />;
  }

  if (order.status !== "PAID") {
    return <Layout status="not-paid" subtext={`Order status: ${order.status}`} />;
  }

  // Defence in depth — webhook may not have fired yet.
  if (order.customerId && order.internalPlanId) {
    const plan = findStudentPlan(order.internalPlanId);
    if (plan) {
      const a = admin();
      const { data: existing } = await a
        .from("subscriptions")
        .select("id")
        .eq("user_id", order.customerId)
        .eq("plan_id", "student")
        .eq("status", "active")
        .maybeSingle();
      if (!existing) {
        await a.from("subscriptions").insert({
          user_id: order.customerId,
          plan_id: "student",
          status: "active",
          started_at: new Date().toISOString(),
        });
      }
    }
  }

  // If they're signed in (the happy path), bounce them straight
  // to /home so they hit their dashboard with no friction.
  if (user) {
    redirect("/home");
  }

  // Otherwise show a success card with a sign-in CTA.
  return <Layout status="paid-needs-signin" />;
}

function Layout({
  status,
  subtext,
}: {
  status: "missing" | "error" | "not-paid" | "paid-needs-signin";
  subtext?: string;
}) {
  const config = {
    missing: {
      title: "We couldn't find your order.",
      body: "If you just paid, give us 30 seconds — Cashfree may still be confirming. Otherwise email hello@myaisetu.com with your order ID and we'll sort it.",
      cta: "Back to home",
      href: "/",
    },
    error: {
      title: "Something went sideways with the payment check.",
      body: "We logged this. Please retry once or email hello@myaisetu.com if it keeps happening.",
      cta: "Try again",
      href: "/join",
    },
    "not-paid": {
      title: "Payment hasn't completed yet.",
      body:
        "We didn't see a successful payment. If you abandoned the Cashfree page, try once more. If you paid and this still shows, drop us a note at hello@myaisetu.com.",
      cta: "Try again",
      href: "/join",
    },
    "paid-needs-signin": {
      title: "Payment confirmed.",
      body:
        "You're all set. Sign in with the email you used and you'll land on your dashboard.",
      cta: "Sign in",
      href: "/login",
    },
  }[status];

  return (
    <div className="landing">
      <main
        style={{
          maxWidth: 560,
          margin: "0 auto",
          padding: "80px 24px 96px",
          textAlign: "center",
        }}
      >
        <h1
          className="lm-serif"
          style={{
            fontSize: 36,
            lineHeight: 1.05,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            margin: 0,
            color: "var(--ink)",
          }}
        >
          {config.title}
        </h1>
        <p
          className="lm-serif"
          style={{
            fontStyle: "italic",
            marginTop: 16,
            fontSize: 16.5,
            lineHeight: 1.5,
            color: "var(--text-2)",
          }}
        >
          {config.body}
        </p>
        {subtext && (
          <p
            className="lm-mono"
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--text-3)",
              letterSpacing: "0.04em",
            }}
          >
            {subtext}
          </p>
        )}
        <Link
          href={config.href}
          className="btn btn--primary"
          style={{ marginTop: 32, display: "inline-flex" }}
        >
          {config.cta}
        </Link>
      </main>
    </div>
  );
}
