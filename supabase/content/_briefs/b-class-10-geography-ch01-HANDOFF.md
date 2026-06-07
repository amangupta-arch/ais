# HANDOFF — Class 10 Geography · Ch.1 (Resources and Development)

**For the deploy session.** This session authors content only — no DB
writes, no loaders, no Supabase bucket, no merge, no PR. Everything below
is staged as files on this branch for you to deploy.

## Where the content is

- **Branch:** `content/class10-geo-ch01` (this branch). Pull it:
  `git fetch origin && git checkout content/class10-geo-ch01`
- Everything lives under `supabase/content/...`, `supabase/migrations/...`.

## File inventory

| Path | What |
|---|---|
| `supabase/migrations/0020_student_plan_class10_geography.sql` | Bundle-insert migration (student tier already exists from 0014) |
| `supabase/content/bundle-courses/13-class10-geo-ch01.yaml` | Bundle + 3 courses + 10 lesson titles |
| `supabase/content/resources-and-resource-planning/NN-*.yaml` | Course 1 lessons, EN |
| `supabase/content/resources-and-resource-planning-hinglish/NN-*.yaml` | Course 1 lessons, Hinglish |
| `supabase/content/_briefs/b-class-10-geography-ch01-resources-and-development.md` | Design brief (full plan, decisions) |
| `supabase/content/_briefs/b-class-10-geography-ch01-image-prompts.md` | Image prompt manifest (filenames, prompts, placements, URLs to fill) |
| `scripts/validate-lesson.ts` | `npx tsx scripts/validate-lesson.ts <dir-or-file>` — Zod check |

## Deploy sequence

1. **Migration:** apply `supabase/migrations/0020_student_plan_class10_geography.sql`
   (inserts the bundle row; idempotent).
2. **Bundle/course structure:** `npx tsx scripts/load-bundle-courses.ts`
   → writes `/tmp/bundles/b-class-10-geography-ch01-resources-and-development.sql`;
   apply it. This upserts courses + lesson stubs and syncs `board:cbse` +
   `medium:en` / `medium:hinglish` tags.
3. **Lesson content:** load the per-lesson YAMLs via the content loader
   (`scripts/load-content.ts` / `npm run content:load`).
4. **Audio:** runs server-side post-load via `runAudioPipeline`
   (`/api/yaml-jobs/generate`). Needs `ELEVENLABS_API_KEY` +
   `SUPABASE_SERVICE_ROLE_KEY`. EN → flash_v2_5; Hinglish → Hindi voice on
   multilingual_v2.
5. **Frontend:** bundle surfaces on `/student` + `/learn` once the rows
   exist (order_index 500, plan tier `student`, emoji 🌍, gradient moss).

## Images (generated + wired — deploy must upload the files)

The 7 Course-1 images are generated and the `media` turns are **already
wired** into all 8 lessons, pointing at deterministic public URLs:
`…/storage/v1/object/public/lesson-images/b-class-10-geography-ch01-resources-and-development/<file>`.
So the only remaining step is getting the actual PNGs into that bucket:

1. Create the public bucket (one-time):
   `insert into storage.buckets (id,name,public) values ('lesson-images','lesson-images',true) on conflict do nothing;`
2. Upload the 7 PNGs to
   `lesson-images/b-class-10-geography-ch01-resources-and-development/<file>`
   using the **exact filenames** the media turns reference (the `url:`s in
   the lesson YAMLs are the source of truth). The files currently live in
   the operator's Google Drive folder `cowork_images/class10-geo-ch01-course1/`.

Filenames: `c1l1-three-resources.png`, `c1l1-human-transforms.png`,
`c1l2-renewable-vs-nonrenewable.png`, `c1l3-need-not-greed.png`,
`c1l3-think-global-act-local.png`, `c1l4-ingredients-to-meal.png`,
`c1l4-uneven-india.png`.

⚠ Until the files are uploaded, those `media` turns will 404 at runtime
(the rest of each lesson — SVG + html_animation + all turns — renders
fine). Upload before going live, or the player just skips the broken image.

## Scope / status

- **Pilot = Course 1 only** (4 lessons), EN + Hinglish. Courses 2–3 are
  declared in the bundle YAML (so the catalogue knows the shape) but their
  lesson YAMLs are NOT authored yet — they load as empty stubs.
- Every authored lesson passes `scripts/validate-lesson.ts`.
