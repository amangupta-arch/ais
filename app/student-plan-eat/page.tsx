// School Student · Class 11 – 12 plan page.
// Public route; no auth gate. See lib/student-plans.ts for the data
// model and components/StudentPlanPage.tsx for layout.

import type { Metadata } from "next";

import StudentPlanPage from "@/components/StudentPlanPage";
import { STUDENT_COHORTS } from "@/lib/student-plans";
import "@/app/landing.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "School Student · Class 11 – 12 plans",
  description:
    "Boards plus entrance prep, wired together. Maya the voice tutor and paper-photo grading for Class 11 and 12. From ₹199/month.",
};

export default function StudentPlanEatPage() {
  return <StudentPlanPage cohort={STUDENT_COHORTS.eat} />;
}
