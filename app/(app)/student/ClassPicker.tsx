// Inline class picker shown on /student when the learner hasn't set a
// school_class yet. Server-rendered <form> per class — no client state,
// no JS required to submit. Each button posts to setSchoolClassAction
// which updates the profile and revalidates /student.

import { setSchoolClassAction } from "./actions";

const CLASSES = [6, 7, 8, 9, 10, 11, 12];

export default function ClassPicker() {
  return (
    <div className="lm-card lm-card--raised" style={{ padding: 28, textAlign: "center" }}>
      <div className="lm-eyebrow" style={{ marginBottom: 8 }}>
        Quick setup
      </div>
      <h1
        className="lm-serif"
        style={{ fontSize: 28, lineHeight: 1.15, fontWeight: 500, margin: "0 0 8px" }}
      >
        Which class are you in?
      </h1>
      <p style={{ fontSize: 14, color: "var(--text-2)", margin: "0 auto 20px", maxWidth: 360 }}>
        We&rsquo;ll show you only the chapters and bundles for your class. You can change this any
        time from your profile.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
          gap: 8,
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {CLASSES.map((n) => (
          <form key={n} action={setSchoolClassAction}>
            <input type="hidden" name="school_class" value={n} />
            <button
              type="submit"
              className="lm-btn lm-btn--secondary"
              style={{ width: "100%", padding: "16px 0", fontSize: 16 }}
            >
              {n}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
