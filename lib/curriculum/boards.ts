// Source-of-truth list of Indian school boards + the medium(s) of
// instruction each board recognises. Used by /yaml-generate (to drive
// the board+medium pickers that filter bundles + feed the AI prompt)
// and reusable by any future user-facing surface (signup quiz, profile
// settings, school-onboarding flows).
//
// Slugs are kebab-case, ≤40 chars (matches the format CHECK on
// profiles.education_board added in migration 0017). Medium codes
// reuse the short language codes already used elsewhere (en, hi, mr,
// ta, te, bn, pa, gu, kn, ml, ur) and add a handful of new ones for
// north-eastern + tribal languages.
//
// Adding a board: append to INDIAN_BOARDS. Adding a medium: append
// to MEDIUM_LABELS and reference its code from the relevant boards.
// No DB migration required — bundles.tags is an unconstrained text[]
// and profiles.education_board / .native_language are free-text.

export type BoardSlug = string;
export type MediumCode = string;

export type IndianBoard = {
  /** Stable slug — used in URLs, tags (board:<slug>), profile column. */
  slug: BoardSlug;
  /** Human-readable label. */
  label: string;
  /** Medium codes this board recognises as a medium of instruction. */
  mediums: MediumCode[];
};

/** Lookup of medium code → display label. Centralised so all surfaces
 *  show the same labels for the same code. */
export const MEDIUM_LABELS: Record<MediumCode, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  pa: "Punjabi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  ur: "Urdu",
  as: "Assamese",
  brx: "Bodo",
  kok: "Konkani",
  mni: "Manipuri",
  lus: "Mizo",
  ne: "Nepali",
  or: "Odia",
};

/** Every recognised board in the AI Setu universe, in the order they
 *  should appear in pickers — national boards first, then state
 *  boards alphabetically. */
export const INDIAN_BOARDS: IndianBoard[] = [
  // National + international
  { slug: "cbse",      label: "CBSE",                    mediums: ["en", "hi"] },
  { slug: "cisce",     label: "CISCE (ICSE/ISC)",        mediums: ["en"] },
  { slug: "ib",        label: "IB (International Bacc.)", mediums: ["en"] },
  { slug: "cambridge", label: "Cambridge (IGCSE/A-Lvl)", mediums: ["en"] },

  // State boards, alphabetical by state name
  { slug: "ap-board",      label: "Andhra Pradesh Board",    mediums: ["te", "en", "ur"] },
  { slug: "ar-board",      label: "Arunachal Pradesh Board", mediums: ["en"] },
  { slug: "as-board",      label: "Assam Board",             mediums: ["as", "en", "bn", "brx"] },
  { slug: "br-board",      label: "Bihar Board",             mediums: ["hi", "en", "ur"] },
  { slug: "cg-board",      label: "Chhattisgarh Board",      mediums: ["hi", "en"] },
  { slug: "ga-board",      label: "Goa Board",               mediums: ["en", "kok", "mr"] },
  { slug: "gj-board",      label: "Gujarat Board",           mediums: ["gu", "en", "hi"] },
  { slug: "hr-board",      label: "Haryana Board",           mediums: ["hi", "en"] },
  { slug: "hp-board",      label: "Himachal Pradesh Board",  mediums: ["hi", "en"] },
  { slug: "jh-board",      label: "Jharkhand Board",         mediums: ["hi", "en"] },
  { slug: "ka-board",      label: "Karnataka Board",         mediums: ["kn", "en"] },
  { slug: "kl-board",      label: "Kerala Board",            mediums: ["ml", "en"] },
  { slug: "mp-board",      label: "Madhya Pradesh Board",    mediums: ["hi", "en"] },
  { slug: "mh-board",      label: "Maharashtra Board",       mediums: ["mr", "en", "hi", "ur"] },
  { slug: "mn-board",      label: "Manipur Board",           mediums: ["en", "mni"] },
  { slug: "ml-board",      label: "Meghalaya Board",         mediums: ["en"] },
  { slug: "mz-board",      label: "Mizoram Board",           mediums: ["en", "lus"] },
  { slug: "nl-board",      label: "Nagaland Board",          mediums: ["en"] },
  { slug: "od-board",      label: "Odisha Board",            mediums: ["or", "en"] },
  { slug: "pb-board",      label: "Punjab Board",            mediums: ["pa", "en", "hi"] },
  { slug: "rj-board",      label: "Rajasthan Board",         mediums: ["hi", "en"] },
  { slug: "sk-board",      label: "Sikkim Board",            mediums: ["en", "ne"] },
  { slug: "tn-board",      label: "Tamil Nadu Board",        mediums: ["ta", "en"] },
  { slug: "tg-board",      label: "Telangana Board",         mediums: ["te", "en", "ur"] },
  { slug: "tr-board",      label: "Tripura Board",           mediums: ["bn", "en"] },
  { slug: "up-board",      label: "Uttar Pradesh Board",     mediums: ["hi", "en", "ur"] },
  { slug: "uk-board",      label: "Uttarakhand Board",       mediums: ["hi", "en"] },
  { slug: "wb-board",      label: "West Bengal Board",       mediums: ["bn", "en"] },
];

/** Quick lookup: slug → board (label + medium list). */
export function findBoard(slug: string): IndianBoard | null {
  return INDIAN_BOARDS.find((b) => b.slug === slug) ?? null;
}

/** Human label for a board slug — falls back to the slug itself if
 *  it's not a recognised board (e.g. a legacy value). */
export function boardLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return findBoard(slug)?.label ?? slug.toUpperCase();
}

/** Human label for a medium code — falls back to the raw code for
 *  unknown values. */
export function mediumLabel(code: string | null | undefined): string {
  if (!code) return "";
  return MEDIUM_LABELS[code] ?? code;
}

/** Mediums available for a board, in their declared order. Returns []
 *  for unknown boards. */
export function mediumsForBoard(slug: string | null | undefined): MediumCode[] {
  if (!slug) return [];
  return findBoard(slug)?.mediums ?? [];
}
