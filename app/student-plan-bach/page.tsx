// College Student · Bachelors plan page.
// Public route; no auth gate. See lib/student-plans.ts for the data
// model and components/StudentPlanPage.tsx for layout.

import type { Metadata } from "next";

import StudentPlanPage from "@/components/StudentPlanPage";
import { STUDENT_COHORTS } from "@/lib/student-plans";
import "@/app/landing.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "College Student · Bachelors plans",
  description:
    "Programme-aware modules, Maya the voice tutor, and paper-photo grading for Bachelor's students. From ₹199/month.",
};

export default function StudentPlanBachPage() {
  return <StudentPlanPage cohort={STUDENT_COHORTS.bach} />;
}
