import type { CurrentLevel, DailyGoalMinutes, Interest, PreferredLanguage, PrimaryGoal, UserRole } from "./types";

export type OnboardingAnswers = {
  displayName?: string;
  primaryGoal?: PrimaryGoal;
  currentLevel?: CurrentLevel;
  role?: UserRole;
  interests?: Interest[];
  preferredLanguage?: PreferredLanguage;
  dailyGoalMinutes?: DailyGoalMinutes;
};

export const STORAGE_KEY = "ais_onboarding_answers";
export const PENDING_KEY = "ais_pending_onboarding";

export const PRIMARY_GOAL_OPTIONS: { id: PrimaryGoal; title: string; blurb: string; emoji: string }[] = [
  { id: "work",          title: "To be sharper at my job",  blurb: "Use AI at work without looking confused in meetings.", emoji: "💼" },
  { id: "side_hustle",   title: "To start a side hustle",   blurb: "Earn on the side using AI skills.",                    emoji: "🚀" },
  { id: "career_switch", title: "To switch careers",        blurb: "Break into a role where AI fluency matters.",          emoji: "🧭" },
  { id: "exam_prep",     title: "To crack an exam",         blurb: "IELTS, NEET, UPSC, JEE — AI-assisted prep.",           emoji: "🎓" },
  { id: "curiosity",     title: "I'm just curious",         blurb: "No agenda. I want to understand what this is.",        emoji: "🌿" },
];

export const CURRENT_LEVEL_OPTIONS: { id: CurrentLevel; title: string; blurb: string }[] = [
  { id: "beginner", title: "Never really used it",          blurb: "Heard the hype, haven't tried." },
  { id: "casual",   title: "Played with ChatGPT once or twice", blurb: "Basic stuff, then moved on." },
  { id: "regular",  title: "I use it most weeks",           blurb: "It's part of my workflow, roughly." },
  { id: "advanced", title: "Daily. I want depth.",          blurb: "I need the next level, not basics." },
];

export const ROLE_OPTIONS: { id: UserRole; title: string; emoji: string }[] = [
  { id: "student",       title: "Student",       emoji: "📚" },
  { id: "professional",  title: "Professional",  emoji: "💼" },
  { id: "entrepreneur",  title: "Entrepreneur",  emoji: "🏗️" },
  { id: "homemaker",     title: "Homemaker",     emoji: "🏡" },
  { id: "other",         title: "Other",         emoji: "✺" },
];

export const INTEREST_OPTIONS: { id: Interest; title: string; emoji: string }[] = [
  { id: "business",  title: "Business",  emoji: "📈" },
  { id: "creative",  title: "Creative",  emoji: "🎨" },
  { id: "writing",   title: "Writing",   emoji: "✍️" },
  { id: "coding",    title: "Coding",    emoji: "⌨️" },
  { id: "marketing", title: "Marketing", emoji: "📣" },
  { id: "research",  title: "Research",  emoji: "🔬" },
  { id: "video",     title: "Video",     emoji: "🎬" },
  { id: "exams",     title: "Exams",     emoji: "🎓" },
  { id: "hindi",     title: "Hindi",     emoji: "🪔" },
];

export const LANGUAGE_OPTIONS: { id: PreferredLanguage; title: string; blurb: string }[] = [
  { id: "en",       title: "English",  blurb: "Default, globally neutral." },
  { id: "hinglish", title: "Hinglish", blurb: "Casual, code-switching between Hindi & English." },
  { id: "hi",       title: "Hindi",    blurb: "Hindi primarily, translations on request." },
];

export const DAILY_GOAL_OPTIONS: { id: DailyGoalMinutes; title: string; recommended?: boolean }[] = [
  { id: 5,  title: "5 minutes" },
  { id: 10, title: "10 minutes", recommended: true },
  { id: 20, title: "20 minutes" },
  { id: 30, title: "30 minutes" },
];

export const REVEAL_LINES_BY_GOAL: Record<PrimaryGoal, string> = {
  work:          "Your first course gets you past small-talk ChatGPT.",
  side_hustle:   "We'll begin with the AI stack side-hustlers swear by.",
  career_switch: "A 12-week rebuild of your skill stack starts tomorrow.",
  exam_prep:     "We'll pair core AI skills with your exam ladder.",
  curiosity:     "We start with the idea behind the idea, no pressure.",
};

export const GENERATING_LINES = [
  "Reading your answers…",
  "Matching your tutor…",
  "Picking your first course…",
  "Sketching your 9-day rhythm…",
  "Ready.",
];
