/** Sentinel value for the bundle dropdown's "orphan courses" option. */
export const ORPHAN_BUNDLE = "__orphan__" as const;
/** Sentinel value for the bundle dropdown's "all courses" option. */
export const ALL_BUNDLES = "__all__" as const;

/** Languages the renderer + loader recognise. EN is the canonical write
 *  path; everything else writes into `lessons.translations[<lang>]`. */
export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English (canonical)" },
  { code: "hinglish", label: "Hinglish" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "bn", label: "Bengali" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
] as const;
