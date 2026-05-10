// Student dashboard. Shows the curriculum bundles for the signed-in
// learner's (institute, class) pair, grouped by subject.
//
//   - Auth-required (under (app)). Anonymous → /login.
//   - If profile.school_class is null, render an inline picker;
//     setting it via the server action rerenders this same page.
//   - Else fetch bundles tagged for the matching curriculum +
//     class:<class> + (optionally) institute:<inst>, render one
//     section per subject.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getMe, getStudentBundles } from "@/lib/supabase/queries";

import ClassPicker from "./ClassPicker";
import StudentDashboard from "./StudentDashboard";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const { user, profile } = await getMe();
  if (!user) redirect("/login?next=/student");

  const lang = profile?.preferred_language ?? "en";
  const schoolClass = profile?.school_class ?? null;
  const institute = profile?.institute ?? null;

  return (
    <main className="lm-page">
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 20px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Link href="/home" aria-label="Home" className="lm-btn lm-btn--icon">
            <ArrowLeft size={18} />
          </Link>
          <div className="lm-eyebrow">Student</div>
        </div>

        {schoolClass === null ? (
          <ClassPicker />
        ) : (
          <StudentDashboardWithData
            schoolClass={schoolClass}
            institute={institute}
            lang={lang}
          />
        )}
      </div>
    </main>
  );
}

async function StudentDashboardWithData({
  schoolClass,
  institute,
  lang,
}: {
  schoolClass: string;
  institute: string | null;
  lang: string;
}) {
  const subjects = await getStudentBundles(schoolClass, institute);
  return (
    <StudentDashboard
      schoolClass={schoolClass}
      institute={institute}
      subjects={subjects}
      lang={lang}
    />
  );
}
