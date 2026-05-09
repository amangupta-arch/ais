export type PrimaryGoal = "work" | "side_hustle" | "career_switch" | "exam_prep" | "curiosity";
export type CurrentLevel = "beginner" | "casual" | "regular" | "advanced";
export type UserRole = "student" | "professional" | "entrepreneur" | "homemaker" | "other";
export type Interest =
  | "business" | "creative" | "writing" | "coding"
  | "marketing" | "research" | "video" | "exams" | "hindi";
export type PreferredLanguage =
  | "en"        // English
  | "hi"        // Hindi
  | "hinglish"  // Hinglish
  | "mr"        // Marathi
  | "pa"        // Punjabi
  | "te"        // Telugu
  | "ta"        // Tamil
  | "bn"        // Bengali
  | "fr"        // French
  | "es";       // Spanish

export const LANGUAGES: { code: PreferredLanguage; native: string; english: string }[] = [
  { code: "en",       native: "English",   english: "English"  },
  { code: "hi",       native: "हिन्दी",      english: "Hindi"    },
  { code: "hinglish", native: "Hinglish",  english: "Hinglish" },
  { code: "mr",       native: "मराठी",      english: "Marathi"  },
  { code: "pa",       native: "ਪੰਜਾਬੀ",     english: "Punjabi"  },
  { code: "te",       native: "తెలుగు",      english: "Telugu"   },
  { code: "ta",       native: "தமிழ்",       english: "Tamil"    },
  { code: "bn",       native: "বাংলা",       english: "Bengali"  },
  { code: "fr",       native: "Français",   english: "French"   },
  { code: "es",       native: "Español",    english: "Spanish"  },
];
export type DailyGoalMinutes = 5 | 10 | 20 | 30;
export type PlanTier = "free" | "basic" | "advanced";

export type Persona = {
  id: "nova" | "arjun" | "riya" | "sensei";
  name: string;
  tagline: string;
  blurb: string;
  glyph: string;
  /** Optional override for the tutor avatar image. If absent, TutorAvatar
   *  falls back to the public bucket convention, then to the initial-letter
   *  block. Populated as Ama uploads portraits. */
  avatar_url?: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "nova",
    name: "Nova",
    tagline: "Warm & patient",
    blurb: "Your default coach. Asks good questions, never rushes.",
    glyph: "✦",
    avatar_url:
      "https://dfdocnhhxrnvblbwwium.supabase.co/storage/v1/object/sign/tutor/nova.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8yODU0NzMwOS1hOWJkLTQ5NjQtYmIwZC1mZTlkZDYwMDM5NDAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0dXRvci9ub3ZhLnBuZyIsImlhdCI6MTc3NzAxMzYzOSwiZXhwIjoxODA4NTQ5NjM5fQ._MaXFgfn-P6mxL3cHzMBarEGY9x2sYpL1V4WzU3EHUU",
  },
  { id: "arjun",  name: "Arjun",  tagline: "Direct & demanding",     blurb: "Senpai energy. Pushes you. Useful when you've been slacking.", glyph: "◆" },
  { id: "riya",   name: "Riya",   tagline: "Chill & Hinglish",       blurb: "Like a friend over chai. Casual, supportive, sometimes roasts.", glyph: "❁" },
  { id: "sensei", name: "Sensei", tagline: "Old-school discipline",  blurb: "Measured, precise. For learners who want zero fluff.", glyph: "☯" },
];

export const personaById = (id: Persona["id"]): Persona =>
  PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  primary_goal: PrimaryGoal | null;
  current_level: CurrentLevel | null;
  role: UserRole | null;
  interests: Interest[];
  native_language: string;
  preferred_language: PreferredLanguage;
  daily_goal_minutes: DailyGoalMinutes;
  daily_reminder_time: string;
  preferred_tutor_persona: Persona["id"];
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: PlanTier;
  name: string;
  tagline: string | null;
  description: string | null;
  price_inr: number;
  price_usd: number;
  billing_period_days: number;
  streak_unlock_days: number;
  max_lessons_per_day: number | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

/** Per-language translation entry for a course. */
export type CourseTranslation = {
  title?: string;
  subtitle?: string;
  description?: string;
};

export type Course = {
  id: string;
  slug: string;
  category: string | null;
  tags: string[];
  plan_tier: PlanTier;
  is_bonus_badge: boolean;
  emoji: string | null;
  cover_gradient: "ember" | "moss" | "paper" | string | null;
  difficulty: "beginner" | "intermediate" | "advanced";
  estimated_minutes: number;
  lesson_count: number;
  order_index: number;
  is_published: boolean;
  bundle_id: string | null;
  translations: Record<string, CourseTranslation>;
};

/** Pull a course's title for the requested language, falling back through
 *  translations.en, then to the slug. Mirrors `bundleTitle`. */
export function courseTitle(c: Course, lang: string): string {
  return c.translations?.[lang]?.title ?? c.translations?.en?.title ?? c.slug;
}

export function courseSubtitle(c: Course, lang: string): string | null {
  return c.translations?.[lang]?.subtitle ?? c.translations?.en?.subtitle ?? null;
}

export function courseDescription(c: Course, lang: string): string | null {
  return c.translations?.[lang]?.description ?? c.translations?.en?.description ?? null;
}

export type BundleTranslation = { title: string; description?: string };

export type Bundle = {
  id: string;
  slug: string;
  plan_tier: Exclude<PlanTier, "free">;
  emoji: string | null;
  cover_gradient: "ember" | "moss" | "paper" | "plum" | string | null;
  order_index: number;
  is_published: boolean;
  tags: string[];
  translations: Record<string, BundleTranslation>;
};

/** Pull a bundle's title in the user's preferred language with English fallback. */
export function bundleTitle(b: Bundle, lang: string): string {
  return b.translations[lang]?.title ?? b.translations.en?.title ?? b.slug;
}

export function bundleDescription(b: Bundle, lang: string): string | null {
  return b.translations[lang]?.description ?? b.translations.en?.description ?? null;
}

export type LessonTranslation = {
  title?: string;
  subtitle?: string;
};

export type Lesson = {
  id: string;
  course_id: string;
  slug: string;
  order_index: number;
  estimated_minutes: number;
  xp_reward: number;
  format: "ai_chat" | string;
  is_published: boolean;
  translations: Record<string, LessonTranslation>;
};

export function lessonTitle(l: Lesson, lang: string): string {
  return l.translations?.[lang]?.title ?? l.translations?.en?.title ?? l.slug;
}

export function lessonSubtitle(l: Lesson, lang: string): string | null {
  return l.translations?.[lang]?.subtitle ?? l.translations?.en?.subtitle ?? null;
}

export type UserStreak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  freezes_available: number;
  total_freezes_used: number;
  streak_goal_days: number;
  updated_at: string;
};

export type UserXp = {
  user_id: string;
  total_xp: number;
  weekly_xp: number;
  week_started_at: string;
  level: number;
  updated_at: string;
};

export type UserCourseProgress = {
  id: string;
  user_id: string;
  course_id: string;
  status: "not_started" | "in_progress" | "completed";
  progress_pct: number;
  last_lesson_id: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export type UserLessonProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  course_id: string;
  status: "not_started" | "in_progress" | "completed";
  current_turn_index: number;
  xp_earned: number;
  time_spent_seconds: number;
  started_at: string | null;
  completed_at: string | null;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: PlanTier;
  status: "active" | "cancelled" | "expired";
  started_at: string;
  expires_at: string | null;
};
