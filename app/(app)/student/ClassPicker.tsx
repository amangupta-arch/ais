// Inline path picker shown on /student when the learner hasn't set a
// school_class yet. Server-rendered <form>-per-option — no client
// state, no JS needed to submit. Each form posts the option's
// (institute, school_class) pair to setSchoolPathAction, which writes
// to profiles + revalidates the page.

import { setSchoolPathAction } from "./actions";
import { GROUP_TITLES, SCHOOL_PATH_OPTIONS, type SchoolPathOption } from "./paths";

export default function ClassPicker() {
  const groups = SCHOOL_PATH_OPTIONS.reduce<Record<string, SchoolPathOption[]>>(
    (acc, opt) => {
      (acc[opt.group] ??= []).push(opt);
      return acc;
    },
    {},
  );
  const titles = GROUP_TITLES();

  return (
    <div className="lm-card lm-card--raised" style={{ padding: 28 }}>
      <div className="lm-eyebrow" style={{ marginBottom: 8, textAlign: "center" }}>
        Quick setup
      </div>
      <h1
        className="lm-serif"
        style={{
          fontSize: 28,
          lineHeight: 1.15,
          fontWeight: 500,
          margin: "0 0 8px",
          textAlign: "center",
        }}
      >
        Where are you studying?
      </h1>
      <p
        style={{
          fontSize: 14,
          color: "var(--text-2)",
          margin: "0 auto 24px",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        We&rsquo;ll show you only the chapters and bundles for your class. You can change this any
        time from your profile.
      </p>

      {Object.entries(groups).map(([group, options]) => (
        <div key={group} style={{ marginBottom: 20 }}>
          <div className="lm-eyebrow" style={{ marginBottom: 8 }}>
            {titles[group as SchoolPathOption["group"]]}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                group === "school"
                  ? "repeat(auto-fit, minmax(64px, 1fr))"
                  : "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8,
            }}
          >
            {options.map((opt) => (
              <form
                key={`${opt.institute ?? "school"}::${opt.schoolClass}`}
                action={setSchoolPathAction}
              >
                {opt.institute && (
                  <input type="hidden" name="institute" value={opt.institute} />
                )}
                <input type="hidden" name="school_class" value={opt.schoolClass} />
                <button
                  type="submit"
                  className="lm-btn lm-btn--secondary"
                  style={{
                    width: "100%",
                    padding: group === "school" ? "16px 0" : "14px 16px",
                    fontSize: group === "school" ? 16 : 14,
                    flexDirection: opt.subtitle ? "column" : "row",
                    gap: opt.subtitle ? 2 : 0,
                  }}
                >
                  <span>
                    {group === "school" ? opt.schoolClass : opt.label}
                  </span>
                  {opt.subtitle && (
                    <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                      {opt.subtitle}
                    </span>
                  )}
                </button>
              </form>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
