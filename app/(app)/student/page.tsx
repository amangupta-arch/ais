// Student dashboard. The post-login + post-payment landing page.
//
//   - Auth-required (under (app)). Anonymous → /login?next=/student.
//   - profile.school_class === null → render the inline ClassPicker
//     so the user can self-serve their class without bouncing to
//     /onboarding.
//   - Otherwise render the dashboard: greeting, today's hero, stats,
//     weekly strip, up-next lessons, and the curriculum subject grid.
//
// Replaces /home as the default post-auth destination. /home is kept
// as a "browse everything" library page reachable via "See more".

import { redirect } from "next/navigation";

import {
  getAllCourses,
  getMe,
  getMyCourseProgress,
  getMyUpNextLessons,
  getMyWeeklyActivity,
  getStudentBundles,
} from "@/lib/supabase/queries";

import ClassPicker from "./ClassPicker";
import StudentDashboard from "./StudentDashboard";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const { user, profile, streak, xp } = await getMe();
  if (!user) redirect("/login?next=/student");

  const lang = profile?.preferred_language ?? "en";
  const schoolClass = profile?.school_class ?? null;
  const institute = profile?.institute ?? null;
  const board = profile?.education_board ?? null;
  // native_language is NOT NULL DEFAULT 'en' in 0001_init.sql, so
  // using it directly would make the medium filter always-on and
  // hide every bundle that lacks a medium:* tag from legacy users.
  // Gate it on `board` instead: education_board is truly nullable
  // and only gets populated by the join quiz, the same step where
  // the user told us their medium.
  const medium = board ? (profile?.native_language ?? null) : null;

  if (schoolClass === null) {
    return (
      <main className="lm-page">
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "56px 20px 64px" }}>
          <ClassPicker />
        </div>
      </main>
    );
  }

  // Fetch everything the dashboard needs in parallel.
  const [subjects, courseProgress, upNext, weekly, courses] = await Promise.all([
    getStudentBundles(schoolClass, institute, board, medium),
    getMyCourseProgress(),
    getMyUpNextLessons(3),
    getMyWeeklyActivity(),
    getAllCourses(),
  ]);

  const completedLessons = courseProgress.filter((p) => p.status === "completed").length;

  return (
    <StudentDashboard
      firstName={profile?.first_name ?? profile?.display_name ?? user.email ?? ""}
      schoolClass={schoolClass}
      institute={institute}
      lang={lang}
      streakDays={streak?.current_streak ?? 0}
      totalXp={xp?.total_xp ?? 0}
      completedLessons={completedLessons}
      weekly={weekly}
      upNext={upNext}
      subjects={subjects}
      allCourses={courses}
    />
  );
}
