// /join — the multi-step quiz funnel.
//
// Lands ad traffic directly. No auth wall at entry; sign-in
// happens at the final step (Google OAuth or email magic link).
// Quiz answers accumulate in localStorage as the visitor moves
// through the steps; /join/finalize reads them after auth and
// writes to the profile, then routes by class.
//
// This page is a thin server wrapper — the real UI lives in the
// JoinQuiz client component so we get framer-motion transitions
// and per-step state without a server round-trip.

import type { Metadata } from "next";

import "./join.css";
import JoinQuiz from "./JoinQuiz";

// Used to be force-static, but reading searchParams.error to surface
// an "auth failed, restart the quiz" banner means this has to render
// per-request. The quiz itself is still a client component — only
// the thin wrapper here is dynamic.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join AI Setu — a Maya plan curated for you",
  description:
    "A two-minute quiz. Then a Maya-powered plan crafted around your class, board, and language.",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <JoinQuiz initialError={error ?? null} />;
}
