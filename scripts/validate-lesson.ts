import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { lessonSchema } from "../lib/content/schema";

const target = process.argv[2];
if (!target) { console.error("usage: tsx validate-lesson.ts <file-or-dir>"); process.exit(2); }

function listYaml(p: string): string[] {
  if (statSync(p).isDirectory()) {
    return readdirSync(p)
      .filter((f) => /^\d\d-.*\.ya?ml$/.test(f))
      .sort()
      .map((f) => join(p, f));
  }
  return [p];
}

let failed = 0;
for (const file of listYaml(target)) {
  try {
    const doc = yaml.load(readFileSync(file, "utf8"));
    const res = lessonSchema.safeParse(doc);
    if (res.success) {
      const turns = (res.data.turns as unknown[]).length;
      const last = (res.data.turns as { type: string }[]).at(-1)?.type;
      const xpSum = (res.data.turns as { xp?: number }[]).reduce((n, t) => n + (t.xp ?? 0), 0);
      console.log(`PASS  ${file}  (${turns} turns, last=${last}, turnXP=${xpSum}, reward=${res.data.xp_reward})`);
    } else {
      failed++;
      console.log(`FAIL  ${file}`);
      for (const issue of res.error.issues) {
        console.log(`   • ${issue.path.join(".")}: ${issue.message}`);
      }
    }
  } catch (e) {
    failed++;
    console.log(`ERROR ${file}: ${(e as Error).message}`);
  }
}
if (failed === 0) console.log(`\n${listYaml(target).length}/${listYaml(target).length} passed.`);
process.exit(failed ? 1 : 0);
