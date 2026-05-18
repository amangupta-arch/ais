"use client";

// Mounts the Meta Pixel SDK and fires PageView on every Next.js
// route change. The SDK itself drops the `_fbp` cookie on init and
// constructs `_fbc` automatically when the visitor lands with
// ?fbclid=… in the URL.
//
// No-ops in dev (or anywhere NEXT_PUBLIC_META_PIXEL_ID isn't set)
// so the console isn't littered with 404s from a missing pixel.

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, Suspense } from "react";

declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
    };
    _fbq?: Window["fbq"];
  }
}

function PixelPageViewTracker({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The inline Script's `afterInteractive` strategy runs the init +
  // first PageView itself, which beats our useEffect on the initial
  // mount. Skip the first hook fire so we don't double-count it.
  const firstFire = useRef(true);

  useEffect(() => {
    if (firstFire.current) {
      firstFire.current = false;
      return;
    }
    if (typeof window === "undefined" || !window.fbq) return;
    window.fbq("track", "PageView");
  }, [pathname, searchParams, pixelId]);

  return null;
}

export function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  return (
    <>
      <Script id="meta-pixel-bootstrap" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixelId}');
          fbq('track', 'PageView');
        `}
      </Script>
      <Suspense fallback={null}>
        <PixelPageViewTracker pixelId={pixelId} />
      </Suspense>
    </>
  );
}
