"use client";

// Client island for /students-plan. Renders the offer card + phone
// input + Pay button, and handles the Cashfree.js v3 SDK invocation
// when the visitor clicks Pay.
//
// Flow:
//   1. Load https://sdk.cashfree.com/js/v3/cashfree.js (Next/Script)
//   2. On click: call createCheckoutSession server action
//   3. Receive { paymentSessionId, env }
//   4. window.Cashfree({ mode }).checkout({ paymentSessionId,
//      redirectTarget: '_self' }) — SDK navigates the tab to the
//      hosted payment page with the right method list rendered.

import { useState } from "react";
import Script from "next/script";

import { createCheckoutSession } from "./actions";
import type { StudentPlan } from "@/lib/student-plans";

type CashfreeMode = "sandbox" | "production";

declare global {
  interface Window {
    Cashfree?: (opts: { mode: CashfreeMode }) => {
      checkout: (opts: {
        paymentSessionId: string;
        redirectTarget: "_self" | "_blank" | "_top" | "_modal";
      }) => void;
    };
  }
}

export default function CheckoutCard({
  plan,
  initialError,
}: {
  plan: StudentPlan;
  initialError: string | null;
}) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [sdkReady, setSdkReady] = useState(false);

  const phoneValid = /^[6-9]\d{9}$/.test(phone);

  async function onPay() {
    setBusy(true);
    setError(null);
    try {
      const result = await createCheckoutSession({ planId: plan.id, phone });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      if (!window.Cashfree) {
        setError(
          "Payment library didn't load. Refresh the page and try again.",
        );
        setBusy(false);
        return;
      }
      const cashfree = window.Cashfree({
        mode: result.env === "PRODUCTION" ? "production" : "sandbox",
      });
      cashfree.checkout({
        paymentSessionId: result.paymentSessionId,
        redirectTarget: "_self",
      });
      // SDK navigates the tab; nothing else to do.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <>
      <Script
        src="https://sdk.cashfree.com/js/v3/cashfree.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onLoad={() => setSdkReady(true)}
      />

      {error && (
        <div
          role="alert"
          style={{
            margin: "0 0 24px",
            padding: "12px 16px",
            background: "var(--coral-soft)",
            border: "1px solid var(--coral)",
            borderRadius: "var(--r-3)",
            color: "var(--coral-deep)",
            fontSize: 14,
            lineHeight: 1.5,
            maxWidth: 380,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          className="tier tier--featured"
          style={{ maxWidth: 380, width: "100%" }}
        >
          <div className="tier__badge">Most chosen</div>
          <div className="tier__name">{plan.label}</div>
          <div className="tier__price">
            <span className="cur">₹</span>
            {plan.priceInr}
            <span className="per"> / month</span>
          </div>
          <div className="tier__sub">{plan.tagline}</div>
          <ul className="tier__list">
            {plan.features.map((f) => (
              <li key={f}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M5 12l5 5 9-12" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          <label
            style={{
              display: "block",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            Mobile number for payment
          </label>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="10-digit Indian mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-2)",
              fontSize: 15,
              fontFamily: "var(--font-sans)",
              marginBottom: 14,
              background: "var(--paper)",
              color: "var(--ink)",
            }}
          />

          <button
            type="button"
            className="tier__cta"
            onClick={onPay}
            disabled={busy || !sdkReady || !phoneValid}
            style={{ cursor: busy || !sdkReady || !phoneValid ? "not-allowed" : "pointer" }}
          >
            {busy
              ? "Opening payment…"
              : !sdkReady
              ? "Loading…"
              : `Pay ₹${plan.priceInr} / month`}
          </button>

          <p
            style={{
              marginTop: 10,
              fontSize: 11.5,
              color: "var(--text-3)",
              textAlign: "center",
              lineHeight: 1.4,
              fontStyle: "italic",
            }}
          >
            UPI · cards · net-banking · all handled by Cashfree.
          </p>
        </div>
      </div>
    </>
  );
}
