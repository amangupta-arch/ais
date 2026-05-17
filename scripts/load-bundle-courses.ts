#!/usr/bin/env tsx
/**
 * Generates SQL DO blocks (one per bundle) from supabase/content/bundle-courses/*.yaml.
 *
 *   npx tsx scripts/load-bundle-courses.ts
 *
 * Output: /tmp/bundles/<bundle-slug>.sql — each idempotently upserts ~9 courses
 * + their lesson stubs (titles only, no turns) under one bundle. Apply via the
 * Supabase MCP `execute_sql` tool, one file at a time.
 *
 * Re-run after adding a new YAML: regenerates all SQL files. Idempotent at the
 * SQL layer thanks to ON CONFLICT (slug) DO UPDATE.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

type LessonStub = string;

type CourseStub = {
  title: string;
  outcome: string;
  lessons: LessonStub[];
};

type BundleStub = {
  bundle_slug: string;
  /** Optional board(s) the bundle is suitable for. String or array.
   *  Synced into bundles.tags as 'board:<slug>' so /student filters
   *  by profile.education_board. Non-curriculum bundles omit this. */
  board?: string | string[];
  /** Optional medium(s) of instruction. String or array. Synced into
   *  bundles.tags as 'medium:<lang>' so /student filters by
   *  profile.native_language. Non-curriculum bundles omit this. */
  medium?: string | string[];
  courses: CourseStub[];
};

/** Normalise board/medium YAML fields (string | string[]) to a flat
 *  list of tag values, lowercased + trimmed. Empty input → []. */
function tagValuesFor(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
}

type YamlFile = {
  bundles: BundleStub[];
};

const CONTENT_ROOT = fileURLToPath(
  new URL("../supabase/content/bundle-courses", import.meta.url),
);
const OUT_DIR = "/tmp/bundles";

const GRADIENTS = ["ember", "moss", "paper", "plum"] as const;
const FALLBACK_EMOJI = "📘";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function shortSlug(title: string): string {
  // Prefer the part before the first colon ("AI, Decoded: What It..." -> "AI, Decoded")
  const head = title.split(/[:—–]/)[0] ?? title;
  const s = slugify(head);
  return s.length >= 4 ? s : slugify(title);
}

function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''");
}

/** Naive estimator: lessons × 8min, clamped 25–80. */
function estimateMinutes(lessonCount: number): number {
  return Math.max(25, Math.min(80, lessonCount * 8));
}

/** Beginner for first 3, intermediate next 3, advanced for last 3. */
function difficultyFor(courseIndex: number): "beginner" | "intermediate" | "advanced" {
  if (courseIndex < 3) return "beginner";
  if (courseIndex < 6) return "intermediate";
  return "advanced";
}

function loadBundles(): BundleStub[] {
  const files = readdirSync(CONTENT_ROOT)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  const all: BundleStub[] = [];
  for (const f of files) {
    const raw = readFileSync(join(CONTENT_ROOT, f), "utf8");
    const doc = yaml.load(raw) as YamlFile;
    if (!doc?.bundles) {
      console.warn(`skip ${f}: no top-level 'bundles' key`);
      continue;
    }
    all.push(...doc.bundles);
  }
  return all;
}

function generateBundleSql(
  bundle: BundleStub,
  bundleIndex: number,
  globalSlugSet: Set<string>,
): string {
  const courseRows: string[] = [];
  const lessonInsertsPerCourse: { courseSlug: string; sql: string }[] = [];

  bundle.courses.forEach((course, ci) => {
    let baseSlug = shortSlug(course.title);
    let slug = baseSlug;
    let suffix = 1;
    // Ensure global uniqueness; on collision append the bundle's tool hint.
    const bundleHint = bundle.bundle_slug.replace(/^b-/, "");
    while (globalSlugSet.has(slug)) {
      slug = `${baseSlug}-${bundleHint}`;
      if (globalSlugSet.has(slug)) {
        slug = `${baseSlug}-${bundleHint}-${++suffix}`;
      } else {
        break;
      }
    }
    globalSlugSet.add(slug);

    const subtitle = course.outcome.length > 120
      ? course.outcome.slice(0, 117) + "…"
      : course.outcome;
    const description = `Outcome: ${course.outcome}.`;
    const emoji = FALLBACK_EMOJI;
    const gradient = GRADIENTS[(bundleIndex + ci) % GRADIENTS.length]!;
    const difficulty = difficultyFor(ci);
    const minutes = estimateMinutes(course.lessons.length);
    const orderIndex = (bundleIndex + 1) * 1000 + (ci + 1) * 10;

    // Course translations: jsonb keyed by language. Authored YAML is EN.
    const courseTranslationsJson = JSON.stringify({
      en: { title: course.title, subtitle, description },
    });
    courseRows.push(
      `  (v_bundle_id, '${slug}', '${escapeSqlString(courseTranslationsJson)}'::jsonb, v_plan_tier, '${emoji}', '${gradient}', '${difficulty}', ${minutes}, ${orderIndex})`,
    );

    const lessonValues: string[] = [];
    const lessonSlugs = new Set<string>();
    course.lessons.forEach((title, li) => {
      let lslug = slugify(title);
      if (!lslug) lslug = `lesson-${li + 1}`;
      // Local uniqueness within the course only (lesson uniqueness is by course_id+slug).
      let candidate = lslug;
      let n = 2;
      while (lessonSlugs.has(candidate)) candidate = `${lslug}-${n++}`;
      lessonSlugs.add(candidate);
      const lessonTranslationsJson = JSON.stringify({ en: { title } });
      lessonValues.push(
        `    (v_course_id, '${candidate}', '${escapeSqlString(lessonTranslationsJson)}'::jsonb, ${li + 1}, 10, 50)`,
      );
    });

    lessonInsertsPerCourse.push({
      courseSlug: slug,
      sql: lessonValues.join(",\n"),
    });
  });

  // Stage 1: upsert all courses for this bundle in one statement, returning ids.
  // Stage 2: per-course, look up the id and refresh its lesson stubs.
  const courseUpsert = `
  INSERT INTO courses (bundle_id, slug, translations, plan_tier, emoji, cover_gradient, difficulty, estimated_minutes, order_index)
  VALUES
${courseRows.join(",\n")}
  ON CONFLICT (slug) DO UPDATE SET
    bundle_id = EXCLUDED.bundle_id,
    translations = EXCLUDED.translations,
    plan_tier = EXCLUDED.plan_tier,
    emoji = COALESCE(courses.emoji, EXCLUDED.emoji),
    cover_gradient = EXCLUDED.cover_gradient,
    difficulty = EXCLUDED.difficulty,
    estimated_minutes = EXCLUDED.estimated_minutes,
    order_index = EXCLUDED.order_index;`;

  const lessonBlocks = lessonInsertsPerCourse
    .map(
      ({ courseSlug, sql }) => `
  SELECT id INTO v_course_id FROM courses WHERE slug = '${courseSlug}';
  DELETE FROM lessons WHERE course_id = v_course_id;
  INSERT INTO lessons (course_id, slug, translations, order_index, estimated_minutes, xp_reward) VALUES
${sql};
  UPDATE courses SET lesson_count = (SELECT COUNT(*) FROM lessons WHERE course_id = v_course_id) WHERE id = v_course_id;`,
    )
    .join("\n");

  // Sync the board:* / medium:* tag dimensions from YAML into
  // bundles.tags. Strips any existing tags in those two namespaces
  // first, then appends the ones the YAML declares — so dropping or
  // changing a board/medium in YAML actually propagates (the previous
  // append-only version left stale tags behind, which served the
  // wrong cohorts on /student).
  //
  // Tags outside the board:/medium: namespaces (curriculum, class:*,
  // subject:*, institute:*) are preserved verbatim — those come from
  // migrations, not YAML.
  //
  // Emitted unconditionally so removing all board/medium fields from
  // a bundle's YAML also strips any lingering tags. The empty-array
  // case is a no-op for bundles that never had them.
  const boardTags = tagValuesFor(bundle.board).map((b) => `board:${b}`);
  const mediumTags = tagValuesFor(bundle.medium).map((m) => `medium:${m}`);
  const declaredArrayLiteral = [...boardTags, ...mediumTags]
    .map((t) => `'${escapeSqlString(t)}'`)
    .join(",");
  const declaredArraySql = declaredArrayLiteral
    ? `ARRAY[${declaredArrayLiteral}]`
    : `ARRAY[]::text[]`;
  const tagSyncSql = `
  UPDATE bundles SET tags = ARRAY(
    SELECT DISTINCT t FROM unnest(
      ARRAY(
        SELECT u FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS u
        WHERE u NOT LIKE 'board:%' AND u NOT LIKE 'medium:%'
      ) || ${declaredArraySql}
    ) AS t
  ) WHERE id = v_bundle_id;`;

  // v_plan_tier is read from the bundle row at execute time so the
  // courses inherit the right tier — previously hardcoded to 'basic',
  // which silently downgraded student/advanced bundles' courses and
  // broke entitlement gating on /learn/[courseSlug].
  return `-- Bundle: ${bundle.bundle_slug}
DO $$
DECLARE
  v_bundle_id uuid;
  v_plan_tier text;
  v_course_id uuid;
BEGIN
  SELECT id, plan_tier INTO v_bundle_id, v_plan_tier FROM bundles WHERE slug = '${bundle.bundle_slug}';
  IF v_bundle_id IS NULL THEN
    RAISE EXCEPTION 'bundle not found: ${bundle.bundle_slug}';
  END IF;
${tagSyncSql}
${courseUpsert}
${lessonBlocks}
END $$;
`;
}

function sqlStr(s: string): string {
  return `'${escapeSqlString(s)}'`;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const bundles = loadBundles();
  console.log(`Loaded ${bundles.length} bundles from YAML`);

  const globalSlugs = new Set<string>();
  let courseTotal = 0;
  let lessonTotal = 0;

  bundles.forEach((bundle, idx) => {
    const sql = generateBundleSql(bundle, idx, globalSlugs);
    const outPath = join(OUT_DIR, `${bundle.bundle_slug}.sql`);
    writeFileSync(outPath, sql, "utf8");
    courseTotal += bundle.courses.length;
    lessonTotal += bundle.courses.reduce((n, c) => n + c.lessons.length, 0);
    console.log(`  ${bundle.bundle_slug}: ${bundle.courses.length} courses, ${bundle.courses.reduce((n, c) => n + c.lessons.length, 0)} lessons → ${outPath}`);
  });

  console.log(`\nTotal: ${bundles.length} bundles, ${courseTotal} courses, ${lessonTotal} lessons`);
  console.log(`SQL files written to ${OUT_DIR}/`);
}

main();
