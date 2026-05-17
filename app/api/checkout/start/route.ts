// GET /api/checkout/start (legacy)
//
// Used to be the entry point that created a Cashfree order
// server-side and redirected the browser to the hosted checkout
// URL. That URL form turned out to be an undocumented internal
// Cashfree endpoint — the supported path is Cashfree.js v3 in the
// browser, which we now invoke from /students-plan.
//
// Kept as a redirect so old bookmarks / cached preview links /
// half-shipped client code don't 404. Everything funnels through
// /students-plan now.

import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://myaisetu.com";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.redirect(new URL("/students-plan", APP_URL));
}
