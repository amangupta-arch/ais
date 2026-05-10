"use client";

/** Top-level error boundary. Next.js renders this when an error
 *  bubbles past every nested error.tsx (or escapes a server component's
 *  render). We forward the error to Sentry so React render crashes get
 *  the same surface area as API failures, then show a minimal fallback
 *  the user can recover from with a single tap. */

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
