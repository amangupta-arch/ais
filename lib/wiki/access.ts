// Admin allow-list for /wiki.
//
// The wiki carries internal architecture notes, decision logs and
// runbooks. We keep it admin-only via a comma-separated env var
// (no DB migration, no admin UI) — perfect for a one-or-two-person
// operator team today.
//
//   WIKI_ADMINS=hello@myaisetu.com,founder@myaisetu.com
//
// To graduate later, add `profiles.is_admin boolean` and have the
// gate check that column instead. The /wiki layout consumes this
// helper exclusively; everything downstream assumes "if you can
// see /wiki, you can see everything in /wiki".

export function adminEmails(): string[] {
  const raw = process.env.WIKI_ADMINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

export function isWikiAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}
