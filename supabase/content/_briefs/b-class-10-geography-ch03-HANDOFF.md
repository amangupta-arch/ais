# HANDOFF — Class 10 Geography · Ch.3 (Water Resources)

**For the deploy session.** Content-only branch — no DB writes/loaders/merge from here.

## Where
- Branch `content/class10-geo-ch03` — `git fetch origin && git checkout content/class10-geo-ch03`

## Files
| Path | What |
|---|---|
| `supabase/migrations/0022_student_plan_class10_geo_ch03.sql` | Bundle insert (student tier exists from 0014) |
| `supabase/content/bundle-courses/15-class10-geo-ch03.yaml` | Bundle + 3 courses + 9 lesson titles |
| `supabase/content/the-water-scarcity-puzzle/NN-*.yaml` | Course 1 EN (+ `-hinglish`) |
| `supabase/content/multi-purpose-river-projects/NN-*.yaml` | Course 2 EN (+ `-hinglish`) |
| `supabase/content/harvesting-the-rain/NN-*.yaml` | Course 3 EN (+ `-hinglish`) |
| `supabase/content/_briefs/b-class-10-geography-ch03-*.md` | brief, image prompts |
| `scripts/validate-lesson.ts` | validator (incl. {{blank-N}} fill check) |

## Deploy sequence
1. Apply migration `0022` (order_index 520, 💧, paper).
2. `npx tsx scripts/load-bundle-courses.ts` → apply `/tmp/bundles/b-class-10-geography-ch03-water-resources.sql`.
3. Content loader for the 18 lesson YAMLs.
4. Audio → `runAudioPipeline` (NOT `/yaml-generate`). EN flash_v2_5; Hinglish Hindi voice + multilingual_v2.
5. Frontend surfaces on /student + /learn.

## Images (prompts queued — none wired)
8 prompts in Drive `cowork_images/class10-geo-ch03-course{1,2,3}.md`. cowork → `class10-geo-ch03-courseN/`; then wire media turns to `…/lesson-images/b-class-10-geography-ch03-water-resources/<file>` and upload PNGs there.

## Status
- Full chapter: 3 courses, 9 lessons, EN + Hinglish = 18 files. All pass `validate-lesson.ts`; EN↔HI parity verified; Roman Hinglish (no Devanagari).
- **fill_in_the_blank templates use `{{blank-N}}` tokens** (the renderer requirement — `___` does not render inputs).
