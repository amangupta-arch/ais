// /join/finalize
//
// Where the user lands after sign-in completes (Google OAuth,
// email + password, or phone + OTP). We read the pending
// quiz from localStorage (where JoinQuiz.tsx stashed it),
// POST it to the server to save onto the profile, then redirect
// by class:
//
//   class 6–10  → /students-plan  (offer page → Cashfree.js SDK)
//   anything else → /join/contact-us
//
// If localStorage is empty (different browser, cleared cache),
// the server still runs applyPendingQuiz with an empty patch and
// reads the profile's existing school_class to route — so the
// flow is resilient to lost-quiz cases.

import "@/app/landing.css";
import FinalizeClient from "./FinalizeClient";

export const dynamic = "force-dynamic";

export default function FinalizePage() {
  return <FinalizeClient />;
}
