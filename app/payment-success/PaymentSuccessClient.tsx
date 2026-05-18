"use client";

// Brief confirmation pane shown after a PAID order. Fires the
// browser-side Pixel Purchase (event_id = orderId, matching the
// webhook's CAPI Purchase) and then navigates the tab to the
// dashboard.
//
// We wait ~600ms before navigating so Meta has time to flush the
// Pixel beacon. The beacon itself uses navigator.sendBeacon when
// supported, so an instant redirect *usually* survives — but the
// extra moment also lets the user see a clear "paid" confirmation
// instead of a flash.

import { useEffect } from "react";

import "@/app/landing.css";
import { track } from "@/lib/meta/track";

export default function PaymentSuccessClient({
  orderId,
  amountInr,
  planId,
  nextHref,
}: {
  orderId: string;
  amountInr: number;
  planId: string | null;
  nextHref: string;
}) {
  useEffect(() => {
    track(
      "Purchase",
      {
        value: amountInr,
        currency: "INR",
        content_ids: planId ? [planId] : undefined,
        content_type: "product",
      },
      { eventID: orderId },
    );
    const t = window.setTimeout(() => {
      window.location.href = nextHref;
    }, 700);
    return () => window.clearTimeout(t);
  }, [orderId, amountInr, planId, nextHref]);

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
          Payment confirmed.
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
          Taking you to your dashboard…
        </p>
        <div
          style={{
            width: 40,
            height: 40,
            margin: "32px auto 0",
            borderRadius: "50%",
            border: "3px solid var(--border)",
            borderTopColor: "var(--indigo)",
            animation: "ais-spinner 0.9s linear infinite",
          }}
        />
        <style>{`
          @keyframes ais-spinner {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    </div>
  );
}
