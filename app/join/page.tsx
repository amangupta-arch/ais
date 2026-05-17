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

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Join AI Setu — a Maya plan curated for you",
  description:
    "A two-minute quiz. Then a Maya-powered plan crafted around your class, board, and language.",
};

export default function JoinPage() {
  return <JoinQuiz />;
}
