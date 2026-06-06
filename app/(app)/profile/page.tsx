import { redirect } from "next/navigation";
import Link from "next/link";

import { getMe, getPlans } from "@/lib/supabase/queries";
import { LANGUAGES } from "@/lib/types";
import { signOutAction } from "./actions";
import { formatTier } from "@/lib/utils";
import type { PlanTier, PreferredLanguage } from "@/lib/types";

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
            language
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
            Bundles, courses, and lessons render in this language when a translation exists.
          </p>
          <div
            style={{
              display: "grid",
              // auto-fill keeps every tile the same width on every
              // viewport; minmax(120px,1fr) gives 2 columns on the
              // smallest screens and as many as 5 on desktop. The
              // surrounding form removes width: 100% so the column
              // sizing dominates the button width.
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 8,
              marginTop: 12,
            }}
          >
            {LANGUAGES.map((l) => {
              const active = currentLanguage === l.code;
              return (
                <form key={l.code} action={updateLanguageAction} style={{ display: "contents" }}>
                  <input type="hidden" name="language" value={l.code} />
                  <button
                    type="submit"
                    className={`lm-btn ${active ? "lm-btn--accent" : "lm-btn--secondary"} lm-btn--sm`}
                    style={{
                      width: "100%",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      gap: 2,
                      padding: "10px 8px",
                      minHeight: 56,
                    }}
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
            <span className="lm-tabular" style={{ marginRight: 8 }}>02</span>
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
            <span className="lm-tabular" style={{ marginRight: 8 }}>03</span>
            school path
          </p>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-3)" }}>
            What you told us during sign-up. Drives the{" "}
            <Link href="/student" style={{ color: "var(--indigo)" }}>/student</Link>{" "}
            dashboard. To change anything,{" "}
            <a href="mailto:hello@myaisetu.com" style={{ color: "var(--indigo)" }}>
              email us
            </a>
            .
          </p>
          <div
            className="lm-card"
            style={{
              marginTop: 14,
              padding: 16,
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 10,
            }}
          >
            <ReadonlyRow label="Class" value={classLabel(profile?.school_class)} />
            <ReadonlyRow label="Board" value={boardLabel(profile?.education_board)} />
            {profile?.education_board === "state" && (
              <ReadonlyRow label="State board" value={stateBoardLabel(profile?.state_board)} />
            )}
            <ReadonlyRow
              label="Medium of instruction"
              value={mediumLabel(profile?.native_language)}
            />
          </div>
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

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between" style={{ gap: 12 }}>
      <span
        className="lm-mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-3)",
        }}
      >
        {label}
      </span>
      <span
        className="lm-serif"
        style={{ fontSize: 15, color: "var(--text)", fontWeight: 500, textAlign: "right" }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── label maps (mirror /join quiz options) ──────────────────────

function classLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  if (slug === "college") return "College";
  if (slug === "other") return "Something else";
  // K-12 grades are numeric strings.
  if (/^\d{1,2}$/.test(slug)) return `Class ${slug}`;
  return slug;
}

function boardLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  const map: Record<string, string> = {
    cbse: "CBSE",
    icse: "ICSE",
    state: "State Board",
    ib: "IB",
    cambridge: "Cambridge (IGCSE)",
    other: "Other",
  };
  return map[slug] ?? slug;
}

function stateBoardLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  const map: Record<string, string> = {
    maharashtra: "Maharashtra (MSBSHSE)",
    up: "Uttar Pradesh (UPMSP)",
    bihar: "Bihar (BSEB)",
    "west-bengal": "West Bengal (WBBSE)",
    "tamil-nadu": "Tamil Nadu",
    "andhra-pradesh": "Andhra Pradesh (BSEAP)",
    telangana: "Telangana",
    karnataka: "Karnataka (KSEEB)",
    kerala: "Kerala (SCERT)",
    rajasthan: "Rajasthan (RBSE)",
    "madhya-pradesh": "Madhya Pradesh (MPBSE)",
    gujarat: "Gujarat (GSEB)",
    punjab: "Punjab (PSEB)",
    haryana: "Haryana (BSEH)",
    odisha: "Odisha (BSE)",
    chhattisgarh: "Chhattisgarh (CGBSE)",
    jharkhand: "Jharkhand (JAC)",
    assam: "Assam (SEBA)",
    uttarakhand: "Uttarakhand (UBSE)",
    "himachal-pradesh": "Himachal Pradesh (HPBOSE)",
    "jammu-kashmir": "J&K (JKBOSE)",
    goa: "Goa (GBSHSE)",
    other: "Other state board",
  };
  return map[slug] ?? slug;
}

function mediumLabel(slug: string | null | undefined): string {
  if (!slug) return "—";
  const map: Record<string, string> = {
    en: "English",
    hi: "हिन्दी",
    mr: "मराठी",
    ta: "தமிழ்",
    te: "తెలుగు",
    bn: "বাংলা",
    pa: "ਪੰਜਾਬੀ",
    gu: "ગુજરાતી",
    kn: "ಕನ್ನಡ",
    ml: "മലയാളം",
    ur: "اردو",
  };
  return map[slug] ?? slug;
}
