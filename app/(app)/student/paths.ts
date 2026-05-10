// The set of (institute, class) combinations a learner can pick from.
//
// Single source of truth for both the inline ClassPicker on /student
// and the class-selector on /profile. Adding a new program — e.g. a
// new NMIMS semester or a new institute — is a one-line edit here.
//
// Each option carries:
//   - institute: null for K-12, slug for higher-ed
//   - schoolClass: slug-shaped value stored in profiles.school_class
//   - label / subtitle: rendered on the picker buttons

export type SchoolPathOption = {
  /** What goes into profiles.institute (null for K-12). */
  institute: string | null;
  /** What goes into profiles.school_class. */
  schoolClass: string;
  /** Headline label, e.g. "Class 10" or "BBA · Sem 01". */
  label: string;
  /** Optional secondary line, e.g. "NMIMS". */
  subtitle?: string;
  /** Grouping bucket on the picker UI. */
  group: "school" | "nmims";
};

const k12: SchoolPathOption[] = [6, 7, 8, 9, 10, 11, 12].map((n) => ({
  institute: null,
  schoolClass: String(n),
  label: `Class ${n}`,
  group: "school",
}));

const nmims: SchoolPathOption[] = [
  {
    institute: "nmims",
    schoolClass: "bba-sem-01",
    label: "BBA · Sem 01",
    subtitle: "NMIMS",
    group: "nmims",
  },
];

export const SCHOOL_PATH_OPTIONS: SchoolPathOption[] = [...k12, ...nmims];

/** Resolve a (institute, schoolClass) pair back to the option that
 *  matches it. Returns null if no option lines up — rendering should
 *  fall back to a generic "Class <X>" label in that case. */
export function findSchoolPath(
  institute: string | null,
  schoolClass: string,
): SchoolPathOption | null {
  return (
    SCHOOL_PATH_OPTIONS.find(
      (o) => o.institute === institute && o.schoolClass === schoolClass,
    ) ?? null
  );
}

export function GROUP_TITLES(): Record<SchoolPathOption["group"], string> {
  return { school: "School", nmims: "NMIMS" };
}
