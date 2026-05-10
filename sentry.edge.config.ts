/** Sentry edge-runtime init. Loaded by instrumentation.ts when Next
 *  invokes a route in the edge runtime (middleware, edge route
 *  handlers). Same DSN as server; smaller feature set. */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
});
