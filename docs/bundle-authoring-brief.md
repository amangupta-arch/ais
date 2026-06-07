# AIS bundle authoring — brief for a fresh agent session

You are authoring one full bundle of interactive lessons for the AIS
learning platform (Next.js + Supabase, https://myaisetu.com). A "bundle"
is the unit AIS displays as a single chapter / module / topic on the
`/student` and `/learn` surfaces.

You receive **source material** from the operator. That material defines
the scope. It might be:

- one NCERT chapter
- a UPSC syllabus section
- an AI-tool tutorial
- a custom corporate training module
- anything else with structured learning content

You don't assume what the source is. You read what's provided and stay
strictly within it. No inventing topics the source doesn't cover. No
skipping topics it does cover.

---

## What you produce

Files written **directly at their final repo paths**, committed to a
dedicated branch (`bundle/<bundle-slug>`), one commit per lesson, a PR
opened against `main` when the bundle is complete.

```
supabase/
├── content/
│   ├── _briefs/
│   │   └── <bundle-slug>.md                # design doc you maintain (see below)
│   ├── bundle-courses/
│   │   └── <NN>-<bundle-shortname>.yaml    # bundle + course/lesson structure
│   ├── <course-slug>/
│   │   ├── 01-<lesson-slug>.yaml           # English lessons
│   │   └── 02-<lesson-slug>.yaml
│   └── <course-slug>-hinglish/
│       ├── 01-<lesson-slug>.yaml           # Hinglish translations
│       └── 02-<lesson-slug>.yaml
└── migrations/
    └── <NNNN>_<bundle-slug>.sql            # bundle-insert migration
```

The branch + PR are the deliverable. Once merged, the operator applies
the migration + runs the loader script. No copying, no `out/` staging
folder, no manual file moves.

### Commit + branch discipline

- One commit per lesson. Commit message: `content(<bundle-slug>): lesson <NN> · <lesson title>`.
- Update `_briefs/<bundle-slug>.md` in the **same commit** as each lesson.
  The brief evolves with the work; keep them in lockstep.
- Push the branch after each commit so progress is visible even if the
  session dies mid-bundle.
- The migration SQL + bundle-courses YAML go in the **first** commit on
  the branch (commit message: `content(<bundle-slug>): scaffold bundle + courses`),
  before any lesson commits.
- Open the PR only when every lesson (English + Hinglish) has passed the
  quality checklist. PR title is the bundle title. PR body opens with the
  brief's "Arc" section, then lists lesson count + total estimated minutes
  + any decisions worth flagging for the reviewer.

---

## Inputs the operator provides at session start

Everything in this list **must** come from the operator. Don't infer
defaults. Ask if any are missing.

| Input | Example |
|---|---|
| Source material | One or more files / URLs / pasted text |
| Bundle title (English) | "Class 10 Math · Ch.1 Real Numbers" |
| Bundle slug | `b-class-10-math-ch01-real-numbers` |
| Bundle short name (for filenames) | `class10-math-ch01` |
| `class:<x>` tag | `class:10` |
| `subject:<x>` tag | `subject:mathematics` |
| `board:<x>` tag (if any) | `board:cbse` |
| `medium:<x>` tag (if any) | `medium:en` |
| Other tags (if any) | `curriculum`, `institute:nmims`, etc. |
| Emoji | `🔢` |
| `cover_gradient` | `paper` / `moss` / `ember` / `plum` |
| `order_index` | An integer; operator picks the slot |
| Migration number | The next available `NNNN` |
| Plan tier | `student` (default for school content) |

---

## Reads before you write a single line

In this order:

1. `docs/lesson-yaml-knowledge.md` — the authoritative YAML format spec.
   Every turn type and its required fields are defined here. The existing
   `/yaml-generate` server endpoint loads this file as its system prompt.
   Treat it as canon.

2. `lib/content/schema.ts` — the Zod schema your YAML must validate
   against. If a field isn't in here, don't invent it.

3. `supabase/content/prime-factorization/01-why-primes-are-the-atoms-of-numbers.yaml`
   — the AIS style anchor. Read end-to-end. Match this voice and pacing.
   Note especially: direct second-person address, concrete-before-abstract,
   one sustained metaphor per lesson, italicised emphasis on subtle
   distinctions, "what would break if X" framing for proofs, opening hook
   that's a question nobody asks in class.

4. `supabase/content/bundle-courses/10-class10-math.yaml` — the
   bundle/courses YAML format. Your `_courses.yaml` mirrors this shape.

5. `supabase/migrations/0014_student_plan_class10_math.sql` — the
   bundle-insert migration shape. Your migration mirrors this.

6. `lib/yaml-generation/catalog.ts` — file-path conventions. The function
   `lessonYamlPath` defines exactly where each YAML lands. Your output
   structure must match.

7. Any prior `_briefs/<bundle-slug>.md` files for similar bundles (if they
   exist) — to align with patterns already chosen.

---

## Workflow

### Step 1. Read the source. Plan the chapter brief.

Before authoring anything, write
`supabase/content/_briefs/<bundle-slug>.md`. This is the design doc that
survives session compaction. Include:

- **Arc** — one paragraph telling the whole story of the bundle. What
  shift in understanding does it create?
- **Courses** — 2-5 courses, each named, each with a one-sentence outcome
  ("student can …"). The course is the right size if a competent learner
  reaches the outcome in 30–60 minutes.
- **Lessons per course** — 3–5 lessons each, titled. Each lesson is
  10–13 minutes of work for the learner.
- **Anchors** — sustained metaphors, recurring visuals, voice anchors.
  ("We'll use the 'atoms' metaphor through the whole bundle. SVGs are
  factor trees and classification trees.")
- **Decisions log** — append as you author. "Lesson 2 introduced a
  vocabulary card; reuse the format in Lesson 5." Future sessions read
  this before authoring.

The brief is your memory. Commit it before lesson 1. Update it after
every lesson.

### Step 2. Author the bundle/course shape

Write `supabase/content/bundle-courses/<NN>-<short>.yaml`. Mirror
the format of `10-class10-math.yaml`. One entry per bundle:

```yaml
bundles:
  - bundle_slug: <operator-provided>
    board: <operator-provided>
    medium: <operator-provided>
    courses:
      - title: "<Course title>"
        outcome: "<One sentence — what the student can do>"
        lessons:
          - "<Lesson 1 title>"
          - "<Lesson 2 title>"
```

Lesson titles will be slugified later — write titles that yield clean
slugs (avoid colons, parens, special punctuation in titles).

### Step 3. Author the bundle migration

Write `supabase/migrations/<NNNN>_<bundle-slug>.sql`. Mirror
`0014_student_plan_class10_math.sql` but only the **bundle insert**
section — the `plans` row already exists, the `bundles.plan_tier`
constraint already admits `student`. Your migration is just:

```sql
insert into bundles (slug, plan_tier, emoji, cover_gradient,
                     order_index, tags, translations)
values (...)
on conflict (slug) do update set
  plan_tier = excluded.plan_tier,
  emoji     = excluded.emoji,
  ...
```

Tags array: every tag the operator provided, including the marker
(`curriculum` or whatever taxonomy applies).

Translations: at minimum `{"en": {"title": "...", "description": "..."}}`.
Description is one short paragraph. Lift from your bundle brief's "arc".

### Step 4. Author the English lessons, one at a time

For each lesson, the file path is:
`supabase/content/<course-slug>/<NN>-<lesson-slug>.yaml`

`<NN>` is the two-digit lesson order (`01`, `02`, …).
`<lesson-slug>` is the title slugified.

Open the lesson with the question the lesson answers. Close it with
the question the next lesson answers (the checkpoint summary).

#### YAML structure per lesson

```yaml
title: "<lesson title>"
subtitle: "<one short clause that hooks the curious>"
estimated_minutes: 10-13
xp_reward: 80-100

turns:
  - type: tutor_message
    persona: nova
    text: |
      <markdown allowed: **bold**, *italic*, lists, blockquotes,
      colour directives :red[...], highlight :hl[...]>

  - type: svg_graphic
    xp: 0
    title: "<CAPS TITLE>"
    caption: "<one sentence>"
    svg: |
      <svg ...>...</svg>

  - type: mcq
    xp: 15
    question: "..."
    options:
      - { id: a, text: "...", is_correct: false, rationale: "..." }
      - { id: b, text: "...", is_correct: true,  rationale: "..." }

  - type: tap_to_match
    xp: 15
    prompt: "..."
    left:
      - { id: l1, label: "..." }
    right:
      - { id: r1, label: "..." }
    pairs:
      - [l1, r1]

  - type: exercise
    xp: 20
    tool: pencil      # or 'keyboard'
    instruction: |
      ...
    placeholder: "..."

  - type: fill_in_the_blank
    xp: 10
    prompt: "..."
    template: |
      The capital of ___ is ___.
    answers:
      - { id: blank-1, accepted: ["..."] }

  - type: reflection
    xp: 5
    prompt: "..."
    placeholder: "..."

  - type: checkpoint
    xp: 0
    title: "<one sentence — what the student now sees>"
    summary: |
      <2-3 sentences. The summary ends with the question the next
      lesson opens with.>
```

#### Turn count + mix

10–13 turns total. Suggested mix:
- 5–7 × `tutor_message`
- 1–2 × `svg_graphic` (more if visuals are core)
- 1 × `mcq` (probes the most common misconception)
- 1 × `tap_to_match` OR `drag_to_reorder` (cement vocabulary or steps)
- 1 × `exercise` (pencil → student works on paper, types final answer)
- 1 × `fill_in_the_blank` (lock in terminology)
- 1 × `reflection` (no right answer)
- 1 × `checkpoint` (closes the loop, hands off to next lesson)

This is a guideline, not a quota. If a lesson is mostly conceptual, lean
on `tutor_message` and `mcq`. If it's procedural, lean on `exercise`.

#### Persona

Every `tutor_message` uses `persona: nova`. The product retired other
personas (Maya, Arjun, Riya, Sensei aren't authored). Don't reference
the persona by name in lesson text — just use second person ("you", "we").

#### Graphics

For diagrams that fit (factor trees, classification trees, simple flows,
maps with shaded regions): author inline SVG in the YAML. Match the
style of the Math chapter — viewBox sized for mobile, neutral
fill colors, readable text labels, captions explaining what the
visual shows. SVG is the default for diagrams because it ships in the
YAML, no external assets to track.

For photographs or complex illustrations: the operator will tell you
which connectors are available (image generation, asset storage). If
none are available, stop and ask before fabricating image URLs.

#### Audio

You do not generate audio yourself. The AIS platform runs an ElevenLabs
pipeline against the lesson's text after the YAML lands in the DB. Your
job ends at YAML + PR.

That said, you author **text that's about to be spoken**, so write
audio-friendly prose:

- **Punctuation is pacing**. Commas → short breath. Full stops, exclamation
  marks, question marks → longer breath. Em-dashes → mid-sentence pause.
  ElevenLabs respects this; the more punctuation you use deliberately, the
  better the narration sounds.
- **Avoid unspeakable characters** in `tutor_message.text` — no `→`, `⇒`,
  `≈`, `∴`, `≠`. Use words instead ("therefore", "approximately equal to",
  "is not equal to"). Math symbols (`+`, `−`, `×`, `÷`, `=`, `<`, `>`, `²`,
  `³`, `²ⁿ`) are fine; ElevenLabs verbalises them.
- **Write `4ⁿ`, not `4^n`**. ElevenLabs reads superscripts cleanly.
- **Numbers >12 should be digits**, not words. ElevenLabs reads "23456"
  correctly. Spelling it out ("twenty-three thousand…") creates clunky audio.
- **Acronyms get clarification on first use**. "HCF (the Highest Common
  Factor)" the first time, then "HCF" alone after.
- **One thought per `tutor_message`** is the cleanest audio unit. Long
  rambling messages with multiple paragraphs produce monotone narration.
  Break them into 2–3 separate `tutor_message` turns instead.
- **Code blocks, SVG, and MCQ option text are NOT narrated** by the
  pipeline — only the prose inside `tutor_message.text`, `checkpoint.summary`,
  and a few other speakable fields. See `lib/audio/extract.ts` for the
  exact list. You don't need to write code or SVG in a speakable way.

For the storage shape, the manifest, and how to trigger generation,
see `docs/audio-pipeline.md` (or the inline summary at the bottom of
this brief).

### Step 5. Translate each lesson to Hinglish

After you finish all English lessons, walk back through and produce
Hinglish translations. One file per English source:

`supabase/content/<course-slug>-hinglish/<NN>-<lesson-slug>.yaml`

Rules:

- **Structure is identical.** Same number of turns, same turn types in
  the same order, same IDs (option IDs, blank IDs, pair IDs).
- **Translate the human-readable strings** (`text`, `question`,
  `options[].text`, `options[].rationale`, `prompt`, `template`,
  `instruction`, `placeholder`, `caption`, `summary`).
- **Don't translate** the YAML keys, the SVG content, slugs, persona
  names, or directive markers (`:red[…]`, `:hl[…]`, `**bold**`).
- **Hinglish = Roman-script Hindi mixed naturally with English.** Not
  Devanagari. Match how a Class 10 student in a Hindi-medium school
  actually speaks. ("Yeh equation balance karne ke liye dono sides
  par same operation karna hota hai." — not "इस equation को…".)
- **MCQ rationales** are the highest-value translation work. They're
  where the teaching happens. Don't shortcut them.

### Step 6. Update the brief

Append to `_briefs/<bundle-slug>.md` as you go. After every lesson,
note: anchors you reused, decisions about voice, places where the
source was thin or contradictory.

### Step 7. Open the PR

Push the final commit, then open a pull request against `main`.

- **Title**: the bundle's display title (same as the `translations.en.title`
  field on the bundle row).
- **Body**: a verbatim copy of the brief's "Arc" section, then a stats
  block, then a short "How to apply" block for the reviewer:

```markdown
## Arc

<paste the brief's "Arc" paragraph here>

## Stats

- Courses: N
- Lessons (EN): N
- Lessons (Hinglish): N
- Total turns: N
- Estimated total minutes: N

## To apply after merge

1. Apply migration: `supabase/migrations/<NNNN>_<slug>.sql`
2. Run: `npx tsx scripts/load-bundle-courses.ts`
3. Apply: `/tmp/bundles/<bundle-slug>.sql`
4. The audio pipeline runs separately against the loaded lessons.
```

The PR does not auto-merge. The reviewer reads the brief, scans a few
lessons, decides.

---

## Quality checklist before delivery

Before you say done, verify each lesson:

- [ ] Validates against `lessonSchema` from `lib/content/schema.ts`
  (mentally walk every field — Zod isn't running here)
- [ ] Every `mcq` has exactly one `is_correct: true` option
- [ ] Every `tap_to_match` `pairs` references IDs that exist on
  `left` and `right`
- [ ] Every `fill_in_the_blank` `template` has as many `___` blanks as
  there are `answers` entries, and each answer's `id` matches `blank-N`
- [ ] Every `tutor_message` has `persona: nova`
- [ ] The checkpoint summary ends with the question the next lesson
  opens with — except the final lesson of the final course, which closes
  the whole bundle
- [ ] `estimated_minutes` × number of lessons ≈ total bundle time the
  source material warrants
- [ ] Every lesson can stand alone — references to prior lessons are
  helpful but never essential

Hinglish-specific:
- [ ] One Hinglish file per English file, at the matching path
- [ ] Same turn IDs across both language versions

---

## What you should NOT do

- Don't push directly to `main`. Always work on `bundle/<bundle-slug>`.
- Don't auto-merge the PR. The reviewer decides.
- Don't write to an `out/` staging folder. Files land at their real
  repo paths from the first commit. The branch + PR provide the
  isolation a staging folder was meant to provide.
- Don't invent topics the source doesn't cover. Stay strictly within
  the source.
- Don't skip the brief. The brief is what makes the bundle survive
  session compaction.
- Don't author all lessons in parallel. Sequential authoring lets the
  brief evolve with the work.
- Don't bundle multiple lessons into one commit. One commit per lesson,
  brief updated in the same commit.
- Don't insert anything into the DB. The migration + YAMLs in the
  PR are the deliverable.
- Don't author audio.
- Don't generate images without confirming a connector is wired up.
- Don't use Devanagari for Hinglish.
- Don't use any persona name in lesson text. Second person only.
- Don't open the PR before every lesson has passed the quality checklist.

---

## Reference: audio storage shape

You don't generate audio, but you should understand where it lands so
you can write text that fits the pipeline cleanly.

### Storage bucket

Bucket name: **`lesson-audio`** (Supabase Storage, public read).

File layout inside the bucket — flat, content-addressable:

```
lesson-audio/<voice_id>/<sha256-hash>.mp3
```

Identical text spoken by the same voice produces the same hash → exactly
one mp3 lives in the bucket, no matter how many lessons reference it. A
common opening like "Let's break this down." is generated once and reused
across every lesson that says it.

### Hash formula

```
sha256(`${voiceId}|${model}|${text}`).hex
```

`voiceId` and `model` come from `lib/audio/voices.ts` per language; `text`
is the sanitised speakable extract from the YAML turn (see
`lib/audio/sanitize.ts`).

### Tables

- **`lesson_audio_assets`** — one row per unique audio file. Columns:
  `id`, `hash` (unique), `voice_id`, `model`, `text` (sanitised), `bytes`,
  `storage_path`.
- **`lesson_audio_manifest`** — one row per (lesson, language, turn,
  chunk). Columns: `lesson_id`, `language`, `turn_index`, `chunk_index`,
  `asset_id` (FK → `lesson_audio_assets.id`), `text`. This is the table
  the player reads to know which mp3 to fetch for which turn.

A single `tutor_message` can produce multiple chunks when ElevenLabs
splits long text mid-sentence — that's why `chunk_index` exists.

### Per-language voice + model

Set in `lib/audio/voices.ts`:

```
VOICE_IDS = {
  en: gHu9GtaHOXcSqFTK06ux,           // same voice handles en/hi/hinglish
  hi: gHu9GtaHOXcSqFTK06ux,
  hinglish: gHu9GtaHOXcSqFTK06ux,
  mr / pa / te / ta / bn / fr / es: configured per-language
}

Models:
  en / fr / es      → eleven_flash_v2_5    (cheaper, Latin script)
  hi / hinglish     → eleven_multilingual_v2 (better Indic pronunciation)
  other Indic langs → eleven_multilingual_v2
```

ElevenLabs has no Hinglish voice — the same Hindi voice handles
code-switched text on `multilingual_v2`.

### Pipeline entry point

`runAudioPipeline({ lessonId, language, yamlText })` in
`lib/audio/pipeline.ts` is the single entry. It:

1. Extracts speakable text from each turn (`lib/audio/extract.ts`)
2. Sanitises it (`lib/audio/sanitize.ts`)
3. Hashes
4. Cache hit → reuse asset; cache miss → call ElevenLabs, upload mp3 to
   the bucket, insert `lesson_audio_assets` row
5. Inserts `lesson_audio_manifest` rows mapping turn → asset

Today this is called only from `/api/yaml-jobs/generate` — meaning
audio generation only runs as part of the `/yaml-generate` page flow.
**There is no standalone CLI for audio yet.** Adding one is a half-day
job and worth doing once you're shipping bundles regularly.

### Public URL the player fetches

```
${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lesson-audio/<voice_id>/<hash>.mp3
```

Resolved server-side in `getLessonAudioManifest()` (`lib/supabase/queries.ts`).
