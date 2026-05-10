/** Next.js 15 entrypoint that runs once per runtime before any
 *  request handler. We use it to load the matching Sentry init
 *  for the active runtime (Node.js or edge). */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Surface server-side rendering / route-handler errors to Sentry.
// Re-exported from @sentry/nextjs so Next can call it on every error.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
