// Student dashboard body. Renders subject sections + bundle cards
// for a given (class, institute, lang) tuple. Bundle cards link into
// the existing /learn/bundles/[bundleSlug] route — no new bundle UI
// here.

import Link from "next/link";

import type { StudentSubject } from "@/lib/supabase/queries";
import { bundleDescription, bundleTitle } from "@/lib/types";

import { findSchoolPath } from "./paths";

export default function StudentDashboard({
  schoolClass,
  institute,
  subjects,
  lang,
}: {
  schoolClass: string;
  institute: string | null;
  subjects: StudentSubject[];
  lang: string;
}) {
  const path = findSchoolPath(institute, schoolClass);
  const eyebrow = path
    ? path.subtitle
      ? `${path.subtitle} · ${path.label}`
      : path.label
    : `Class ${schoolClass}`;
  return (
    <>
      <header style={{ marginBottom: 28 }}>
        <div className="lm-eyebrow" style={{ marginBottom: 6 }}>
          {eyebrow}
        </div>
        <h1
          className="lm-serif"
          style={{ fontSize: 32, lineHeight: 1.1, fontWeight: 500, margin: 0 }}
        >
          Your curriculum
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", margin: "10px 0 0" }}>
          {subjects.length === 0
            ? "Nothing for your class yet — we&rsquo;re adding chapters every week."
            : `${subjectCountLabel(subjects.length)} · ${bundleCountLabel(subjects)}`}
        </p>
        <div style={{ marginTop: 12 }}>
          <Link href="/profile" className="lm-btn lm-btn--ghost lm-btn--sm">
            Change class
          </Link>
        </div>
      </header>

      {subjects.length === 0 ? (
        <EmptyState schoolClass={schoolClass} />
      ) : (
        subjects.map((subject) => (
          <section key={subject.key} style={{ marginBottom: 32 }}>
            <h2
              className="lm-serif"
              style={{
                fontSize: 22,
                lineHeight: 1.2,
                fontWeight: 500,
                margin: "0 0 12px",
                color: "var(--text)",
              }}
            >
              {subject.label}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {subject.bundles.map((b) => (
                <Link
                  key={b.id}
                  href={`/learn/bundles/${b.slug}`}
                  className="lm-card"
                  style={{
                    padding: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 160ms",
                  }}
                >
                  {b.emoji && (
                    <div
                      style={{
                        fontSize: 32,
                        flexShrink: 0,
                        width: 56,
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--bg-soft)",
                        borderRadius: "var(--r-3)",
                      }}
                    >
                      {b.emoji}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="lm-serif"
                      style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.25, marginBottom: 4 }}
                    >
                      {bundleTitle(b, lang)}
                    </div>
                    {bundleDescription(b, lang) && (
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-2)",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {bundleDescription(b, lang)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}

function subjectCountLabel(n: number): string {
  return `${n} subject${n === 1 ? "" : "s"}`;
}

function bundleCountLabel(subjects: StudentSubject[]): string {
  const total = subjects.reduce((s, x) => s + x.bundles.length, 0);
  return `${total} chapter${total === 1 ? "" : "s"}`;
}

function EmptyState({ schoolClass }: { schoolClass: string }) {
  return (
    <div
      className="lm-card"
      style={{ padding: 32, textAlign: "center", background: "var(--bg-soft)" }}
    >
      <div className="lm-eyebrow" style={{ marginBottom: 8 }}>
        Coming soon
      </div>
      <p style={{ fontSize: 15, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
        We&rsquo;re still building Class {schoolClass} chapters. Check back soon — or pick a
        different class from your profile.
      </p>
    </div>
  );
}
