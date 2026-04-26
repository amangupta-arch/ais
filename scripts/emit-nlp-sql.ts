import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { lessonSchema, turnContent, turnXpReward } from "../lib/content/schema";

const COURSE_ID = "9d2f55d3-826d-47fb-b9b4-4ccbcaa88a14";
const DIR = "supabase/content/nlp-basics";

const files = readdirSync(DIR).filter((f) => /^(0[2-9]|10)-.*\.yaml$/.test(f)).sort();
const sqlEsc = (s: string) => s.replaceAll("'", "''");
const dq = (s: string) => `$jc$${s}$jc$::jsonb`;

let out = `DO $$\nDECLARE\n  v_course_id uuid := '${COURSE_ID}';\n  v_lesson_id uuid;\nBEGIN\n`;

for (const file of files) {
  const m = file.match(/^(\d+)-(.+)\.yaml$/)!;
  const order = parseInt(m[1], 10);
  const slug = m[2];
  const raw = yaml.load(readFileSync(join(DIR, file), "utf8"));
  const doc = lessonSchema.parse(raw);

  out += `\n  -- ${file}\n`;
  out += `  INSERT INTO lessons (course_id, slug, title, subtitle, order_index, estimated_minutes, xp_reward, format, is_published)\n`;
  out += `  VALUES (v_course_id, '${slug}', '${sqlEsc(doc.title)}', ${doc.subtitle ? `'${sqlEsc(doc.subtitle)}'` : "NULL"}, ${order}, ${doc.estimated_minutes}, ${doc.xp_reward}, 'ai_chat', true)\n`;
  out += `  ON CONFLICT (course_id, slug) DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, order_index = EXCLUDED.order_index, estimated_minutes = EXCLUDED.estimated_minutes, xp_reward = EXCLUDED.xp_reward, format = EXCLUDED.format, is_published = EXCLUDED.is_published\n`;
  out += `  RETURNING id INTO v_lesson_id;\n`;
  out += `  DELETE FROM lesson_turns WHERE lesson_id = v_lesson_id;\n`;
  out += `  INSERT INTO lesson_turns (lesson_id, order_index, turn_type, content, xp_reward, is_required) VALUES\n`;
  const rows = doc.turns.map((turn, i) => {
    const content = JSON.stringify(turnContent(turn));
    const xp = turnXpReward(turn);
    return `    (v_lesson_id, ${i + 1}, '${turn.type}', ${dq(content)}, ${xp}, true)`;
  });
  out += rows.join(",\n") + ";\n";
}

out += `\n  UPDATE courses SET lesson_count = (SELECT count(*) FROM lessons WHERE course_id = v_course_id AND is_published = true) WHERE id = v_course_id;\nEND $$;\n`;
writeFileSync("/tmp/nlp-load.sql", out);
console.log(`Wrote /tmp/nlp-load.sql (${out.length} chars, ${files.length} lessons)`);
