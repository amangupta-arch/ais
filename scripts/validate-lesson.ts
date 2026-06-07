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

const TOKEN_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

/** The renderer (InteractiveBlocks.tsx) only recognises `{{id}}` blank
 *  tokens. Verify every fill template uses them, one per answer id, with
 *  no leftover `___`. Returns a list of human-readable problems. */
function fillProblems(turns: any[]): string[] {
  const out: string[] = [];
  turns.forEach((t, i) => {
    if (t?.type !== "fill_in_the_blank") return;
    const tpl: string = t.template ?? "";
    const tokens = [...tpl.matchAll(TOKEN_RE)].map((m) => m[1]);
    const ids = (t.answers ?? []).map((a: any) => a.id);
    if (tpl.includes("___")) out.push(`turn ${i + 1}: template still has literal '___' (use {{id}} tokens)`);
    if (tokens.length === 0) out.push(`turn ${i + 1}: template has no {{id}} blank tokens`);
    const tokenSet = new Set(tokens), idSet = new Set(ids);
    for (const id of ids) if (!tokenSet.has(id)) out.push(`turn ${i + 1}: answer id '${id}' has no {{${id}}} in template`);
    for (const tk of tokens) if (!idSet.has(tk)) out.push(`turn ${i + 1}: template token {{${tk}}} has no matching answer id`);
  });
  return out;
}

let failed = 0;
const files = listYaml(target);
for (const file of files) {
  try {
    const doc: any = yaml.load(readFileSync(file, "utf8"));
    const res = lessonSchema.safeParse(doc);
    if (!res.success) {
      failed++;
      console.log(`FAIL  ${file}`);
      for (const issue of res.error.issues) console.log(`   • ${issue.path.join(".")}: ${issue.message}`);
      continue;
    }
    const probs = fillProblems(doc.turns ?? []);
    if (probs.length) {
      failed++;
      console.log(`FAIL  ${file}  (fill_in_the_blank)`);
      for (const p of probs) console.log(`   • ${p}`);
      continue;
    }
    const turns = (res.data.turns as unknown[]).length;
    const last = (res.data.turns as { type: string }[]).at(-1)?.type;
    const xpSum = (res.data.turns as { xp?: number }[]).reduce((n, t) => n + (t.xp ?? 0), 0);
    console.log(`PASS  ${file}  (${turns} turns, last=${last}, turnXP=${xpSum}, reward=${res.data.xp_reward})`);
  } catch (e) {
    failed++;
    console.log(`ERROR ${file}: ${(e as Error).message}`);
  }
}
if (failed === 0) console.log(`\n${files.length}/${files.length} passed.`);
process.exit(failed ? 1 : 0);
