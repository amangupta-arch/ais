import { redirect } from "next/navigation";
import Link from "next/link";

import { getMe, getPlans } from "@/lib/supabase/queries";
import { LANGUAGES, PERSONAS } from "@/lib/types";
import { signOutAction } from "./actions";
import { formatTier } from "@/lib/utils";
import type { Persona, PlanTier, PreferredLanguage } from "@/lib/types";
import { SCHOOL_PATH_OPTIONS } from "../student/paths";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, profile, planIds } = await getMe();
  if (!user) redirect("/login");

  const plans = await getPlans();
  // Active subscriptions, joined to the plan catalog. Always falls back
  // to the "free" row so brand-new users still see a card. Order:
  // paid plans first (sort_order asc), free last.
  const activePlans = (planIds.length > 0 ? planIds : (["free"] as PlanTier[]))
    .map((pid) => plans.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (a.id === "free" ? 1 : b.id === "free" ? -1 : (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  const primaryPlan = activePlans[0];
  const currentPersona: Persona["id"] = (profile?.preferred_tutor_persona as Persona["id"]) ?? "nova";
  const currentLanguage: PreferredLanguage = (profile?.preferred_language as PreferredLanguage) ?? "en";

  return (
    <main className="lm-page">
      <div
        className="mx-auto"
        style={{ maxWidth: 640, padding: "24px 20px 40px" }}
      >
        <p className="lm-eyebrow">you</p>
        <h1
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 32, lineHeight: 1.1, color: "var(--text)" }}
        >
          {profile?.display_name ?? user.email ?? "Your profile"}
        </h1>
        {user.email ? (
          <p
            className="lm-mono lm-tabular"
            style={{ marginTop: 4, fontSize: 12, color: "var(--text-3)" }}
          >
            {user.email}
          </p>
        ) : null}

        <section className="lm-card" style={{ marginTop: 32, padding: 20 }}>
          <div className="flex items-start justify-between" style={{ gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="lm-eyebrow">{activePlans.length > 1 ? "plans" : "plan"}</p>
              <p
                className="lm-serif"
                style={{ marginTop: 6, fontSize: 24, lineHeight: 1.15, color: "var(--text)" }}
              >
                {primaryPlan?.name ?? formatTier("free")}
              </p>
              {primaryPlan?.tagline ? (
                <p style={{ marginTop: 2, fontSize: 14, color: "var(--text-3)" }}>
                  {primaryPlan.tagline}
                </p>
              ) : null}
              {activePlans.length > 1 && (
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {activePlans.slice(1).map((p) => (
                    <span
                      key={p.id}
                      className="lm-mono"
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        borderRadius: "var(--r-pill)",
                        background: "var(--bg-soft)",
                        border: "1px solid var(--border-soft)",
                        color: "var(--text-2)",
                      }}
                    >
                      + {p.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/learn"
              style={{
                fontSize: 13,
                color: "var(--text-2)",
                textDecoration: "underline",
              }}
            >
              See catalogue
            </Link>
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>01</span>
            your tutor
          </p>
          <p
            style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}
          >
            Pick the voice that&apos;ll push you best.
          </p>
          <div
            className="grid grid-cols-1 sm:grid-cols-2"
            style={{ gap: 10, marginTop: 16 }}
          >
            {PERSONAS.map((p) => (
              <form key={p.id} action={updateTutorAction}>
                <input type="hidden" name="persona" value={p.id} />
                <button
                  type="submit"
                  className={`lm-option${currentPersona === p.id ? " lm-option--correct" : ""}`}
                  style={{ padding: 16 }}
                >
                  <PersonaAvatar personaId={p.id} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      className="lm-serif"
                      style={{ fontSize: 16, lineHeight: 1.25, color: "inherit" }}
                    >
                      {p.name} —{" "}
                      <em style={{ fontStyle: "italic", color: "var(--text-3)" }}>
                        {p.tagline}
                      </em>
                    </p>
                    <p style={{ marginTop: 4, fontSize: 13, color: "var(--text-3)" }}>
                      {p.blurb}
                    </p>
                  </div>
                </button>
              </form>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>02</span>
            language
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
            Bundles, courses, and lessons render in this language when a translation exists.
          </p>
          <div
            className="flex flex-wrap"
            style={{ gap: 8, marginTop: 12 }}
          >
            {LANGUAGES.map((l) => {
              const active = currentLanguage === l.code;
              return (
                <form key={l.code} action={updateLanguageAction}>
                  <input type="hidden" name="language" value={l.code} />
                  <button
                    type="submit"
                    className={`lm-btn ${active ? "lm-btn--accent" : "lm-btn--secondary"} lm-btn--sm`}
                    style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, padding: "8px 12px" }}
                    aria-pressed={active}
                  >
                    <span style={{ fontWeight: 600 }}>{l.native}</span>
                    {l.native !== l.english ? (
                      <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                        {l.english}
                      </span>
                    ) : null}
                  </button>
                </form>
              );
            })}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>03</span>
            daily protected time
          </p>
          <form
            action={updateDailyGoalAction}
            className="flex flex-wrap"
            style={{ gap: 8, marginTop: 12 }}
          >
            {[5, 10, 20, 30].map((m) => {
              const active = (profile?.daily_goal_minutes ?? 10) === m;
              return (
                <button
                  key={m}
                  type="submit"
                  name="minutes"
                  value={m}
                  className={`lm-btn ${active ? "lm-btn--accent" : "lm-btn--secondary"} lm-btn--sm`}
                >
                  <span className="lm-tabular" style={{ fontWeight: 700 }}>{m}</span> min
                </button>
              );
            })}
          </form>
        </section>

        <section style={{ marginTop: 40 }}>
          <p className="lm-eyebrow">
            <span className="lm-tabular" style={{ marginRight: 8 }}>04</span>
            school path
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
            Drives the <Link href="/student" style={{ color: "var(--indigo)" }}>/student</Link>{" "}
            dashboard — you&rsquo;ll see chapters tagged for this institute and class only.
          </p>
          {SCHOOL_PATH_OPTIONS.length > 0 ? (
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
              {SCHOOL_PATH_OPTIONS.map((opt) => {
                const active =
                  (profile?.institute ?? null) === opt.institute &&
                  profile?.school_class === opt.schoolClass;
                return (
                  <form
                    key={`${opt.institute ?? "school"}::${opt.schoolClass}`}
                    action={updateSchoolPathAction}
                  >
                    <input type="hidden" name="institute" value={opt.institute ?? ""} />
                    <input type="hidden" name="school_class" value={opt.schoolClass} />
                    <button
                      type="submit"
                      className={`lm-btn ${active ? "lm-btn--accent" : "lm-btn--secondary"} lm-btn--sm`}
                      style={{ flexDirection: "column", alignItems: "flex-start", gap: 0, padding: "8px 12px" }}
                      aria-pressed={active}
                    >
                      <span style={{ fontWeight: 600 }}>{opt.label}</span>
                      {opt.subtitle ? (
                        <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                          {opt.subtitle}
                        </span>
                      ) : null}
                    </button>
                  </form>
                );
              })}
            </div>
          ) : null}
        </section>

        <section
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: "1px solid var(--border)",
          }}
        >
          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                fontSize: 13,
                color: "var(--text-3)",
                textDecoration: "underline",
                cursor: "pointer",
                font: "inherit",
                transition: "color 160ms cubic-bezier(0.2,0,0,1)",
              }}
            >
              sign out
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function PersonaAvatar({ personaId }: { personaId: Persona["id"] }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tutor-avatars/${personaId}.png`
    : null;
  return (
    <span className="lm-avatar lm-avatar--md" aria-label={`${personaId} avatar`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <span aria-hidden>{personaId.charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

async function updateTutorAction(formData: FormData) {
  "use server";
  const { updateProfile } = await import("./actions");
  const persona = formData.get("persona");
  if (typeof persona !== "string") return;
  await updateProfile({ preferred_tutor_persona: persona });
}

async function updateDailyGoalAction(formData: FormData) {
  "use server";
  const { updateProfile } = await import("./actions");
  const minutes = Number(formData.get("minutes"));
  if (!Number.isFinite(minutes)) return;
  await updateProfile({ daily_goal_minutes: minutes });
}

async function updateLanguageAction(formData: FormData) {
  "use server";
  const { updateProfile } = await import("./actions");
  const language = formData.get("language");
  if (typeof language !== "string") return;
  const allowed = ["en", "hi", "hinglish", "mr", "pa", "te", "ta", "bn", "fr", "es"];
  if (!allowed.includes(language)) return;
  await updateProfile({ preferred_language: language });
}

async function updateSchoolPathAction(formData: FormData) {
  "use server";
  const { setSchoolPathAction } = await import("../student/actions");
  await setSchoolPathAction(formData);
}
