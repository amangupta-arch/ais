import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null;
  } catch {
    return null;
  }
})();

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" },
        ]
      : [],
  },
  async headers() {
    // Baseline security headers applied to every response.
    // CSP is deliberately NOT here yet — lesson_turns content includes
    // svg_graphic / html_animation blocks rendered via
    // dangerouslySetInnerHTML in LessonPlayer.tsx; a real CSP needs
    // hash-or-nonce work to allow those without weakening it to
    // `unsafe-inline`. Follow-up.
    const securityHeaders = [
      // 2-year HSTS. preload not requested (apex domain choice; flip
      // later via hstspreload.org after running in this mode for a
      // few weeks). includeSubDomains because Vercel previews + apex
      // are all on the same TLD.
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains",
      },
      // No framing — the app isn't designed to be embedded.
      { key: "X-Frame-Options", value: "DENY" },
      // Stop MIME sniffing.
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Keep referer info on-origin, send only origin off-site.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Deny default-off device APIs we don't use. Flip an entry to
      // `self` when a feature genuinely needs it.
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

// Sourcemap upload + tunnel rewrite. Build is a no-op without
// SENTRY_AUTH_TOKEN — keeps local dev fast and CI green when the
// secret isn't configured yet.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Hide the SDK from ad-blockers by routing events through /monitoring.
  tunnelRoute: "/monitoring",
});
