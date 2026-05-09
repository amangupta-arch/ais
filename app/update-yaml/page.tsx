import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { UpdateYamlForm } from "./UpdateYamlForm";
import { listCourses } from "./actions";

export const dynamic = "force-dynamic";

export default async function UpdateYamlPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/update-yaml");

  const courses = await listCourses();

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "0 auto",
        padding: "32px 24px 64px",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: 6,
          }}
        >
          Internal · temporary author tool
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          Paste a lesson YAML
        </h1>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.5 }}>
          Pick a course, paste the lesson YAML below, and submit. The server
          validates with the same schema the loader uses, then upserts the
          lesson row + replaces its turns. The next order index updates after
          a successful load — paste lesson 02 next, etc.
        </p>
        <p style={{ fontSize: 13, color: "#666", marginTop: 8 }}>
          Same shape as <code>supabase/content/&lt;course&gt;/NN-&lt;slug&gt;.yaml</code>.
          Top-level fields: <code>title</code>, <code>subtitle?</code>,{" "}
          <code>estimated_minutes</code>, <code>xp_reward</code>,{" "}
          <code>turns[]</code>. Last turn must be a <code>checkpoint</code>.
        </p>
      </header>

      <UpdateYamlForm courses={courses} />
    </main>
  );
}
