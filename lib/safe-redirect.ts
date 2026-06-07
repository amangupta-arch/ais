// Sanitize a `?next=` style redirect target read from user input.
//
// The risk: `new URL("https://evil.com", origin)` ignores the base
// and returns evil.com — and `window.location.href = "https://evil.com"`
// just navigates off-site. Anywhere we redirect to a query-string
// target after sign-in, attacker can plant a value in `next=` and
// turn our domain into a one-click phishing relay: link looks like
// myaisetu.com, lands on Google OAuth, drops a fresh session cookie,
// then bounces to evil.com with the legit referer + same-browser
// session. Classic open-redirect → credential phish.
//
// The fix is a strict allowlist for local relative paths. Anything
// else falls back to `/student`.

export function safeNext(
  next: string | null | undefined,
  fallback: string = "/student",
): string {
  if (!next || typeof next !== "string") return fallback;
  // Reject ASCII control characters (tab, LF, CR, etc.) up front.
  // The URL parser silently strips 0x09/0x0A/0x0D before resolving,
  // so `?next=/%0A/evil.com` would otherwise pass the path checks
  // below and then resolve as `//evil.com` → off-origin. DEL (0x7F)
  // is in for symmetry; no legitimate path needs control chars.
  if (/[\x00-\x1F\x7F]/.test(next)) return fallback;
  // Must start with a single forward slash → in-app path.
  if (!next.startsWith("/")) return fallback;
  // `//foo` is a protocol-relative URL → resolves off-origin.
  if (next.startsWith("//")) return fallback;
  // Some browsers/proxies normalize `\` to `/`, so `/\evil.com` can
  // become `//evil.com` after a redirect hop. Reject up front.
  if (next.includes("\\")) return fallback;
  return next;
}
