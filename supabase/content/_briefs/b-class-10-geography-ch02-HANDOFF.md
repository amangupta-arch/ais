# HANDOFF — Class 10 Geography · Ch.2 (Forest and Wildlife Resources)

**For the deploy session.** Content-only branch — no DB writes, no
loaders, no merge from here. Everything below is staged as files.

## Where the content is
- **Branch:** `content/class10-geo-ch02` — `git fetch origin && git checkout content/class10-geo-ch02`
- Under `supabase/content/...` and `supabase/migrations/...`.

## File inventory
| Path | What |
|---|---|
| `supabase/migrations/0021_student_plan_class10_geo_ch02.sql` | Bundle insert (student tier already exists from 0014) |
| `supabase/content/bundle-courses/14-class10-geo-ch02.yaml` | Bundle + 3 courses + 9 lesson titles |
| `supabase/content/biodiversity-and-the-web-of-life/NN-*.yaml` | Course 1 lessons, EN (+ `-hinglish`) |
| `supabase/content/protecting-forests-and-wildlife/NN-*.yaml` | Course 2 lessons, EN (+ `-hinglish`) |
| `supabase/content/communities-and-conservation/NN-*.yaml` | Course 3 lessons, EN (+ `-hinglish`) |
| `supabase/content/_briefs/b-class-10-geography-ch02-*.md` | Brief, image prompts |
| `scripts/validate-lesson.ts` | `npx tsx scripts/validate-lesson.ts <dir>` |

## Deploy sequence
1. Apply migration `0021_student_plan_class10_geo_ch02.sql` (order_index 510, emoji 🐯, gradient moss).
2. `npx tsx scripts/load-bundle-courses.ts` → apply `/tmp/bundles/b-class-10-geography-ch02-forest-and-wildlife-resources.sql`.
3. Content loader for the 18 lesson YAMLs.
4. Audio → `runAudioPipeline` (do NOT push through `/yaml-generate` — it regenerates YAML). EN → flash_v2_5; Hinglish → Hindi voice on multilingual_v2.
5. Frontend: surfaces on `/student` + `/learn`.

## Images (prompts queued — none wired yet)
No `media` turns ship (no broken links). 8 prompts in Drive
`cowork_images/class10-geo-ch02-course{1,2,3}.md`. cowork generates into
`class10-geo-ch02-courseN/` subfolders; then media turns get wired to
`…/lesson-images/b-class-10-geography-ch02-forest-and-wildlife-resources/<file>`,
and the PNGs are uploaded to that bucket path. (Same flow as Ch.1.)

## Scope / status
- **Full chapter authored** — 3 courses, 9 lessons, EN + Hinglish = 18
  lesson files. All pass `validate-lesson.ts`; EN↔Hinglish parity verified;
  Hinglish is Roman-script (no Devanagari).
- Source is the **rationalised** NCERT chapter (no IUCN species table /
  depletion-causes table / cheetah-yew boxes — cut from NCERT).
