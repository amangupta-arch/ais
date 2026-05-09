/**
 * Universe of every (bundle, course, lesson) tuple authored across
 * supabase/content/bundle-courses/*.yaml — this is the source-of-truth
 * for which lessons are EXPECTED to exist. Used by both the
 * /yaml-generate UI (picker) and the /yaml-status page (overview).
 *
 * Also derives the canonical on-disk YAML path for any (course, lesson,
 * language) — matching the convention enforced by scripts/load-content.ts:
 *
 *   supabase/content/<course-slug>/NN-<lesson-slug>.yaml          (en)
 *   supabase/content/<course-slug>-<lang>/NN-<lesson-slug>.yaml    (other)
 *
 * Server-only module — uses node:fs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

const CONTENT_ROOT = join(process.cwd(), "supabase/content");
const BUNDLE_COURSES_DIR = join(CONTENT_ROOT, "bundle-courses");

type RawCourse = {
  title: string;
  outcome: string;
  lessons: string[];
};

type RawBundle = {
  bundle_slug: string;
  courses: RawCourse[];
};

type RawFile = { bundles?: RawBundle[] };

/** Mirror of scripts/load-bundle-courses.ts:slugify. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Mirror of scripts/load-bundle-courses.ts:shortSlug. */
export function shortSlug(title: string): string {
  const head = title.split(/[:—–]/)[0] ?? title;
  const s = slugify(head);
  return s.length >= 4 ? s : slugify(title);
}

export type LessonEntry = {
  bundleSlug: string;
  courseSlug: string;
  courseTitle: string;
  courseOutcome: string;
  /** All sibling lesson titles in this course (in order), for context. */
  siblingTitles: string[];
  lessonSlug: string;
  lessonTitle: string;
  /** 1-based; doubles as the NN- file prefix. */
  lessonIndex: number;
  /** Total lessons in this course. */
  courseLessonCount: number;
};

/** Read every bundle-courses YAML and flatten into LessonEntry[]. */
export function enumerateAllLessons(): LessonEntry[] {
  const files = readdirSync(BUNDLE_COURSES_DIR)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  const out: LessonEntry[] = [];
  // Track global course-slug uniqueness with the same disambiguation rule
  // load-bundle-courses.ts uses, so the slugs we emit here match the ones
  // already in the DB.
  const globalCourseSlugs = new Set<string>();

  for (const file of files) {
    const raw = readFileSync(join(BUNDLE_COURSES_DIR, file), "utf8");
    const doc = yaml.load(raw) as RawFile;
    const bundles = doc?.bundles ?? [];

    for (const bundle of bundles) {
      const bundleHint = bundle.bundle_slug.replace(/^b-/, "");

      for (const course of bundle.courses) {
        const baseSlug = shortSlug(course.title);
        let courseSlug = baseSlug;
        let n = 1;
        while (globalCourseSlugs.has(courseSlug)) {
          courseSlug = `${baseSlug}-${bundleHint}`;
          if (globalCourseSlugs.has(courseSlug)) {
            courseSlug = `${baseSlug}-${bundleHint}-${++n}`;
          } else break;
        }
        globalCourseSlugs.add(courseSlug);

        const lessonSlugsLocal = new Set<string>();
        course.lessons.forEach((title, idx) => {
          const s = slugify(title) || `lesson-${idx + 1}`;
          let candidate = s;
          let m = 2;
          while (lessonSlugsLocal.has(candidate)) candidate = `${s}-${m++}`;
          lessonSlugsLocal.add(candidate);

          out.push({
            bundleSlug: bundle.bundle_slug,
            courseSlug,
            courseTitle: course.title,
            courseOutcome: course.outcome,
            siblingTitles: course.lessons,
            lessonSlug: candidate,
            lessonTitle: title,
            lessonIndex: idx + 1,
            courseLessonCount: course.lessons.length,
          });
        });
      }
    }
  }

  return out;
}

/** Folder for a course in a given language: <slug> for EN, <slug>-<lang> otherwise. */
export function courseFolderPath(courseSlug: string, language: string): string {
  const folder = language === "en" ? courseSlug : `${courseSlug}-${language}`;
  return join(CONTENT_ROOT, folder);
}

/** Final on-disk path for a lesson YAML in a given language. */
export function lessonYamlPath(entry: LessonEntry, language: string): string {
  const nn = String(entry.lessonIndex).padStart(2, "0");
  return join(courseFolderPath(entry.courseSlug, language), `${nn}-${entry.lessonSlug}.yaml`);
}

/** Cheap existence check — used by the UI to disable Start when already authored. */
export function lessonYamlExists(entry: LessonEntry, language: string): boolean {
  return existsSync(lessonYamlPath(entry, language));
}
