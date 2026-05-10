// Public route — anyone can take the math quiz, no auth gate. Mirrors
// /onboarding's posture (also public). Logged-in users are welcome but
// not required; the language picker lives in the client component.

import type { Metadata } from "next";

import MathQuizClient from "./MathQuizClient";
import { QUIZ_QUESTIONS } from "./questions";

export const metadata: Metadata = {
  title: "Math quiz · solve on paper",
};

export const dynamic = "force-static";

export default function MathQuizTestPage() {
  return (
    <main className="lm-page">
      <MathQuizClient questions={QUIZ_QUESTIONS} />
    </main>
  );
}
