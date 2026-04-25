import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { getMe } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const { user } = await getMe();
  if (!user) redirect("/login");

  return (
    <main className="lm-page">
      <div
        className="mx-auto"
        style={{ maxWidth: 640, padding: "24px 20px 40px" }}
      >
        <p className="lm-eyebrow">league</p>
        <h1
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 32, lineHeight: 1.1, color: "var(--text)" }}
        >
          Weekly <em style={{ fontStyle: "italic", color: "var(--saffron-deep)" }}>cohorts</em>, coming.
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--text-2)",
          }}
        >
          Five learners, same tier, same week. Quiet competition — the kind
          that actually moves you.
        </p>

        <div
          className="lm-card flex items-start"
          style={{ marginTop: 32, padding: 24, gap: 16 }}
        >
          <div
            className="inline-flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-3)",
              background: "var(--saffron-soft)",
              color: "var(--saffron-deep)",
              flexShrink: 0,
            }}
          >
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p
              className="lm-serif"
              style={{ fontSize: 20, lineHeight: 1.2, color: "var(--text)" }}
            >
              Not yet. Soon.
            </p>
            <p
              style={{
                marginTop: 8,
                fontSize: 14,
                lineHeight: 1.6,
                color: "var(--text-2)",
              }}
            >
              Leagues land after the lesson player does. Build a streak now —
              when leagues open, you&apos;ll already be ahead.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
