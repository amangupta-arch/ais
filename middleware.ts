// Edge middleware: keeps Supabase session cookies fresh on every
// request and provides a defense-in-depth redirect for unauth'd
// users hitting protected app routes.
//
// Each page under app/(app)/* already calls supabase.auth.getUser()
// and redirects if no user — this middleware is the belt-and-
// suspenders backup so one forgotten check on a future page
// doesn't leak data. It also runs the Supabase SSR session refresh
// the server-side createClient() in lib/supabase/server.ts assumes
// is running upstream.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Top-level URL prefixes that map into the app/(app)/* group.
// Match exact `/p` or `/p/...`, so /student-plan-bach (a marketing
// page outside the group) is NOT caught by /student.
const PROTECTED_PREFIXES = [
  "/home",
  "/leagues",
  "/learn",
  "/profile",
  "/student",
];

export async function middleware(request: NextRequest) {
  // Canonical Supabase SSR middleware shape: we hand the same
  // cookie reader/writer pair to createServerClient that the
  // @supabase/ssr docs prescribe. Don't shortcut this — the
  // setAll callback may run multiple times during one refresh.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh tokens. The result is also what we use to decide the
  // redirect below.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Run on every request except:
  //  - Next internals (_next/static, _next/image)
  //  - favicon
  //  - common static assets by extension
  // API routes ARE included so session cookies stay fresh for
  // route handlers that read auth, but the redirect block above
  // only triggers on PROTECTED_PREFIXES (none of which are /api).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$).*)",
  ],
};
