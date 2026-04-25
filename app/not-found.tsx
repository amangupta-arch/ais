import Link from "next/link";

export default function NotFound() {
  return (
    <main className="lm-page flex flex-col justify-center">
      <div
        className="mx-auto"
        style={{ maxWidth: 480, padding: "96px 24px" }}
      >
        <p className="lm-eyebrow">
          <span className="lm-tabular" style={{ marginRight: 8 }}>404</span>
          not found
        </p>
        <h1
          className="lm-serif"
          style={{ marginTop: 8, fontSize: 40, lineHeight: 1.05, color: "var(--text)" }}
        >
          A path that <em style={{ fontStyle: "italic", color: "var(--coral-deep)" }}>doesn&apos;t exist</em>.
        </h1>
        <p
          style={{ marginTop: 12, fontSize: 15, lineHeight: 1.65, color: "var(--text-2)" }}
        >
          It happens. Let&apos;s get you back.
        </p>
        <div className="flex" style={{ gap: 12, marginTop: 24 }}>
          <Link href="/home" className="lm-btn lm-btn--accent">
            Home
          </Link>
          <Link
            href="/"
            className="lm-btn lm-btn--ghost"
          >
            Landing
          </Link>
        </div>
      </div>
    </main>
  );
}
