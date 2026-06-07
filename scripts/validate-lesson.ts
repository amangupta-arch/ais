#!/usr/bin/env tsx
/**
 * Validate hand-authored lesson YAML against the canonical Zod schema
 * (lib/content/schema.ts) BEFORE loading it into the DB. The content
 * loader rejects an invalid lesson wholesale, so catching errors here
 * saves a round-trip.
 *
 *   npx tsx scripts/validate-lesson.ts <file-or-dir> [...more]
 *
 * Examples:
 *   npx tsx scripts/validate-lesson.ts supabase/content/prime-factorization
 *   npx tsx scripts/validate-lesson.ts supabase/content/foo/01-bar.yaml
 *
 * A directory is scanned for NN-<slug>.yaml lesson files (the same
 * convention the loader enforces); _outline.yaml / _exemplar.yaml are
 * skipped. Exits non-zero if any file fails, so it slots into CI / a
 * pre-commit check.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import yaml from "js-yaml";

import { lessonSchema } from "../lib/content/schema";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: tsx scripts/validate-lesson.ts <file-or-dir> [...]");
  process.exit(2);
}

/** A path → the lesson YAML files it covers (NN-<slug>.yaml for dirs). */
function lessonFiles(p: string): string[] {
  if (statSync(p).isDirectory()) {
    return readdirSync(p)
      .filter((f) => /^\d\d-.*\.ya?ml$/.test(f))
      .sort()
      .map((f) => join(p, f));
  }
  return [p];
}

let failed = 0;
let checked = 0;

for (const target of targets) {
  for (const file of lessonFiles(target)) {
    checked++;
    try {
      const doc = yaml.load(readFileSync(file, "utf8"));
      const res = lessonSchema.safeParse(doc);
      if (res.success) {
        const turns = res.data.turns;
        const last = turns.at(-1)?.type;
        const turnXp = turns.reduce(
          (n, t) => n + ((t as { xp?: number }).xp ?? 0),
          0,
        );
        const checkpoints = turns.filter((t) => t.type === "checkpoint").length;
        const warn = last !== "checkpoint"
          ? "  ⚠ last turn is not a checkpoint"
          : checkpoints !== 1
            ? `  ⚠ ${checkpoints} checkpoints (expected 1)`
            : "";
        console.log(
          `PASS  ${file}  (${turns.length} turns, turnXP=${turnXp}, reward=${res.data.xp_reward})${warn}`,
        );
      } else {
        failed++;
        console.log(`FAIL  ${file}`);
        for (const issue of res.error.issues) {
          console.log(`   • ${issue.path.join(".") || "(root)"}: ${issue.message}`);
        }
      }
    } catch (e) {
      failed++;
      console.log(`ERROR ${file}: ${(e as Error).message}`);
    }
  }
}

console.log(`\n${checked - failed}/${checked} passed.`);
process.exit(failed ? 1 : 0);
