import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { lessonSchema } from "../lib/content/schema";

const targets = process.argv.slice(2);
if (targets.length === 0) { console.error("usage: tsx scripts/validate-lesson.ts <file-or-dir> [...]"); process.exit(2); }

function lessonFiles(p: string): string[] {
  if (statSync(p).isDirectory()) {
    return readdirSync(p).filter((f) => /^\d\d-.*\.ya?ml$/.test(f)).sort().map((f) => join(p, f));
  }
  return [p];
}

const TOKEN_RE = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

/** The lesson player (InteractiveBlocks.tsx) only renders blanks written
 *  as `{{id}}` tokens — `___` produces no inputs. Verify every fill
 *  template uses {{id}} tokens, one per answer id, with no leftover `___`. */
function fillProblems(turns: { type?: string; template?: string; answers?: { id: string }[] }[]): string[] {
  const out: string[] = [];
  turns.forEach((t, i) => {
    if (t?.type !== "fill_in_the_blank") return;
    const tpl = t.template ?? "";
    const tokens = [...tpl.matchAll(TOKEN_RE)].map((m) => m[1]);
    const ids = (t.answers ?? []).map((a) => a.id);
    if (tpl.includes("___")) out.push(`turn ${i + 1}: template still uses '___' (need {{id}} tokens)`);
    if (tokens.length === 0) out.push(`turn ${i + 1}: template has no {{id}} blank tokens`);
    const ts = new Set(tokens), is = new Set(ids);
    for (const id of ids) if (!ts.has(id)) out.push(`turn ${i + 1}: answer '${id}' missing {{${id}}} in template`);
    for (const tk of tokens) if (!is.has(tk)) out.push(`turn ${i + 1}: token {{${tk}}} has no matching answer id`);
  });
  return out;
}

let failed = 0, checked = 0;
for (const target of targets) {
  for (const file of lessonFiles(target)) {
    checked++;
    try {
      const doc = yaml.load(readFileSync(file, "utf8"));
      const res = lessonSchema.safeParse(doc);
      const fillProbs = res.success ? fillProblems((doc as { turns?: [] }).turns ?? []) : [];
      if (res.success && fillProbs.length === 0) {
        const turns = res.data.turns;
        const last = turns.at(-1)?.type;
        const turnXp = turns.reduce((n, t) => n + ((t as { xp?: number }).xp ?? 0), 0);
        const checkpoints = turns.filter((t) => t.type === "checkpoint").length;
        const warn = last !== "checkpoint" ? "  ⚠ last turn not a checkpoint"
          : checkpoints !== 1 ? `  ⚠ ${checkpoints} checkpoints` : "";
        console.log(`PASS  ${file}  (${turns.length} turns, turnXP=${turnXp}, reward=${res.data.xp_reward})${warn}`);
      } else {
        failed++;
        console.log(`FAIL  ${file}`);
        if (!res.success) for (const issue of res.error.issues) console.log(`   • ${issue.path.join(".") || "(root)"}: ${issue.message}`);
        for (const p of fillProbs) console.log(`   • ${p}`);
      }
    } catch (e) {
      failed++;
      console.log(`ERROR ${file}: ${(e as Error).message}`);
    }
  }
}
console.log(`\n${checked - failed}/${checked} passed.`);
process.exit(failed ? 1 : 0);
