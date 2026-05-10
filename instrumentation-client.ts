/** Sentry browser init. Loaded automatically by Next.js on every
 *  client bundle (the `instrumentation-client.ts` filename is the
 *  Turbopack-compatible successor to `sentry.client.config.ts`).
 *  Captures unhandled errors + React render errors via the Next.js
 *  root error boundaries. */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 1.0,

  // Session replay is opt-in and adds bundle weight; leave off for now.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
});

// Lets Sentry tie performance traces across client-side route changes.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
