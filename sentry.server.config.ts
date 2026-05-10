/** Sentry server-side init. Loaded by instrumentation.ts on the
 *  Node.js runtime — covers every API route + server component. The
 *  yaml-jobs/generate route (long-running NDJSON stream) is the main
 *  thing this instrumentation exists for. */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Small app — capture every request. Drop to ~0.1 if traces volume
  // becomes a billing concern.
  tracesSampleRate: 1.0,

  // Long-running generator route walks through ~10 stages; default 100
  // breadcrumbs is fine for everything else but worth bumping.
  maxBreadcrumbs: 200,

  // No DSN set in dev / preview = SDK silently no-ops. Keeps local
  // dev quiet without a guard at every call site.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Surface release tags Vercel injects automatically.
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
