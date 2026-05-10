// School Student · Class 6 – 10 plan page.
// Public route; no auth gate. The shared <StudentPlanPage> handles
// nav, content, and the Cashfree-ready checkout button. All data
// (price, features, copy) lives in lib/student-plans.ts.

import type { Metadata } from "next";

import StudentPlanPage from "@/components/StudentPlanPage";
import { STUDENT_COHORTS } from "@/lib/student-plans";
import "@/app/landing.css";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "School Student · Class 6 – 10 plans",
  description:
    "Curriculum-aligned chapters, paper-photo grading, and Maya the voice tutor — for Class 6 to 10. From ₹59/month.",
};

export default function StudentPlanSttPage() {
  return <StudentPlanPage cohort={STUDENT_COHORTS.stt} />;
}
