// Single source of truth for the school / college student plans.
//
// Each cohort has its own URL (e.g. /student-plan-stt) and ships
// with two plan tiers — "All subjects" and "One subject". Plan IDs
// are stable, slug-shaped strings; when we wire up Cashfree
// Subscriptions later, each Cashfree plan_id will line up with one
// of the IDs below so the integration is a one-place change in
// app/checkout/actions.ts.
//
// The cohort short keys (`stt`, `eat`, `bach`) come from the URL
// suffix the product team picked:
//   stt  → "school-to-tenth"   (Class 6–10)
//   eat  → "eleventh-and-twelfth" (Class 11–12)
//   bach → "bachelors"

export type StudentPlanId =
  | "school-6-10-all"
  | "school-6-10-one"
  | "school-11-12-all"
  | "school-11-12-one"
  | "college-bachelors-all"
  | "college-bachelors-one";

export type StudentPlan = {
  /** Stable identifier — used as the Cashfree plan_id mapping key. */
  id: StudentPlanId;
  /** Short label rendered on the card. */
  label: string;
  /** What the learner gets, in one sentence. */
  tagline: string;
  /** Monthly price in INR. Stored as a number so we can format
   *  consistently and pass the same value to Cashfree. */
  priceInr: number;
  /** Bullet list of inclusions. Card renders these with a check. */
  features: string[];
  /** Highlight as the "most chosen" / featured card on the page. */
  recommended?: boolean;
};

export type StudentCohort = {
  /** URL suffix without the leading slash (e.g. "stt"). */
  shortKey: "stt" | "eat" | "bach";
  /** Full route, e.g. "/student-plan-stt". */
  route: string;
  /** Headline on the page, e.g. "School Student". */
  title: string;
  /** Sub-eyebrow above the title, e.g. "Class 6 – 10". */
  classRange: string;
  /** One-paragraph framing under the headline. */
  intro: string;
  /** Lumen hue used to tint the page accents (existing token name). */
  hue: "indigo" | "saffron" | "moss" | "coral" | "ocean" | "plum";
  /** Bullets in the "What you also get" section under the cards. */
  whatsAlsoIncluded: string[];
  /** The two plan tiers offered to this cohort. Order matters —
   *  the recommended one is rendered second / highlighted. */
  plans: StudentPlan[];
};

export const STUDENT_COHORTS: Record<StudentCohort["shortKey"], StudentCohort> = {
  stt: {
    shortKey: "stt",
    route: "/student-plan-stt",
    title: "School Student",
    classRange: "Class 6 – 10",
    intro:
      "The middle and senior school years are when curiosity either takes root or quietly gets killed. Setu shows up every day, in your language, with a tutor who never sighs.",
    hue: "indigo",
    whatsAlsoIncluded: [
      "Maya the voice tutor — patient, warm, in 12 Indian languages",
      "Paper-photo grading — solve on paper, snap, get step-by-step feedback",
      "Curriculum-aligned chapters (CBSE / ICSE / state boards)",
      "Daily streak + XP that actually feel earned, not gamified",
      "Parent-friendly progress digest, weekly",
    ],
    plans: [
      {
        id: "school-6-10-one",
        label: "One subject",
        tagline: "Pick the subject that's hurting most.",
        priceInr: 59,
        features: [
          "Full curriculum for one subject of your choice",
          "Maya tutor + paper grading on that subject",
          "All 12 languages",
          "Cancel any time",
        ],
      },
      {
        id: "school-6-10-all",
        label: "All subjects",
        tagline: "Math, Science, English, Social — the lot.",
        priceInr: 199,
        recommended: true,
        features: [
          "Every subject in your class",
          "Unlimited Maya + unlimited paper grading",
          "Adaptive practice across subjects",
          "Offline lesson packs",
          "Weekly parent digest",
        ],
      },
    ],
  },

  eat: {
    shortKey: "eat",
    route: "/student-plan-eat",
    title: "School Student",
    classRange: "Class 11 – 12",
    intro:
      "Two years that decide a lot. Setu builds on your board syllabus and quietly layers in JEE / NEET-style drills so you're not learning the same idea twice.",
    hue: "saffron",
    whatsAlsoIncluded: [
      "Boards + entrance prep wired together — no double-study",
      "Maya the voice tutor for board topics and competitive prep",
      "Paper-photo grading with stepwise marking",
      "Adaptive PYQ drills with weekly post-mortem",
      "All 12 Indian languages",
    ],
    plans: [
      {
        id: "school-11-12-one",
        label: "One subject",
        tagline: "Lock in your weakest subject for boards + entrance.",
        priceInr: 199,
        features: [
          "Full Class 11 / 12 syllabus for one subject",
          "Adaptive entrance-style drills (JEE / NEET / CUET pool)",
          "Maya tutor + paper grading",
          "All 12 languages",
        ],
      },
      {
        id: "school-11-12-all",
        label: "All subjects",
        tagline: "Boards + entrance, all subjects, one routine.",
        priceInr: 499,
        recommended: true,
        features: [
          "All Class 11 / 12 subjects, board + entrance",
          "Unlimited Maya, with subject-level memory",
          "Unlimited paper grading + step-by-step feedback",
          "Weekly post-mortem of your wrongs across subjects",
          "Offline lesson packs",
        ],
      },
    ],
  },

  bach: {
    shortKey: "bach",
    route: "/student-plan-bach",
    title: "College Student",
    classRange: "Bachelors",
    intro:
      "Engineering, commerce, sciences, humanities. Whatever the syllabus, Setu treats it like a real subject — no \"intro to\" filler, no recap for the sake of recap.",
    hue: "moss",
    whatsAlsoIncluded: [
      "Programme-aware modules (B.Com, B.A., B.Sc, B.Tech …)",
      "Maya tutor that quizzes you on the way to college",
      "Paper-photo grading for problem sets",
      "Concept maps + weekly review on the topics you actually struggled with",
      "All 12 Indian languages",
    ],
    plans: [
      {
        id: "college-bachelors-one",
        label: "One subject",
        tagline: "Pick the paper that decides your CGPA.",
        priceInr: 199,
        features: [
          "Full module coverage for one subject",
          "Maya tutor + paper grading on that subject",
          "Past-paper drills, weekly review",
          "All 12 languages",
        ],
      },
      {
        id: "college-bachelors-all",
        label: "All subjects",
        tagline: "Every subject, every semester, one routine.",
        priceInr: 499,
        recommended: true,
        features: [
          "All subjects in your programme + semester",
          "Unlimited Maya, with course-level memory",
          "Unlimited paper grading + step-by-step",
          "Weekly review across the whole semester",
          "Offline lesson packs",
        ],
      },
    ],
  },
};

/** Look up a plan by its stable ID. Used by the checkout server
 *  action to validate input and resolve the price for Cashfree. */
export function findStudentPlan(id: string): StudentPlan | null {
  for (const cohort of Object.values(STUDENT_COHORTS)) {
    const found = cohort.plans.find((p) => p.id === id);
    if (found) return found;
  }
  return null;
}

/** Resolve which cohort a plan belongs to. Used by the checkout
 *  page to render context ("School Student · Class 6–10 · One subject"). */
export function findStudentPlanCohort(id: string): StudentCohort | null {
  for (const cohort of Object.values(STUDENT_COHORTS)) {
    if (cohort.plans.some((p) => p.id === id)) return cohort;
  }
  return null;
}
