// Admin allowlist — gates internal authoring tools (/yaml-generate,
// /yaml-status, /database-schema, /api/yaml-jobs/*) so a random
// visitor can't kick off Claude API calls on our Anthropic bill or
// scrape the curriculum catalog.
//
// Email is the gate, not a profiles.role flag, for one reason:
// admins sign in via Google OAuth and Supabase populates the auth
// user's email directly. No extra DB write is needed when we add
// a new admin — they just have to be in the allowlist below.
//
// To add an admin: append their lowercased email here, commit, ship.
// (One day we'll move this to a `profile_roles` table; not today.)

const ADMIN_EMAILS = new Set<string>([
  "amangupta.fbi1@gmail.com",
]);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
