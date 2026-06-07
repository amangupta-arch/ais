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

A single output folder, ready to drop into the AIS repo at its final paths:

```
out/
├── supabase/
│   ├── content/
│   │   ├── _briefs/
│   │   │   └── <bundle-slug>.md           # the design doc you maintain (see below)
│   │   ├── bundle-courses/
│   │   │   └── <NN>-<bundle-shortname>.yaml   # bundle + course/lesson structure
│   │   ├── <course-slug>/
│   │   │   ├── 01-<lesson-slug>.yaml      # English lessons
│   │   │   └── 02-<lesson-slug>.yaml
│   │   └── <course-slug>-hinglish/
│   │       ├── 01-<lesson-slug>.yaml      # Hinglish translations
│   │       └── 02-<lesson-slug>.yaml
│   └── migrations/
│       └── <NNNN>_<bundle-slug>.sql       # bundle-insert migration
└── README.md                              # what's in here, in 10 lines
```

The operator runs `cp -r out/* <ais-repo>/` and applies the migration +
loader script. No further authoring touches are needed.

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

Write `out/supabase/content/bundle-courses/<NN>-<short>.yaml`. Mirror
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

Write `out/supabase/migrations/<NNNN>_<bundle-slug>.sql`. Mirror
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
`out/supabase/content/<course-slug>/<NN>-<lesson-slug>.yaml`

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

Don't author audio. The AIS platform runs an ElevenLabs pipeline against
the lesson's text after the YAML is loaded. Your job ends at the YAML.

### Step 5. Translate each lesson to Hinglish

After you finish all English lessons, walk back through and produce
Hinglish translations. One file per English source:

`out/supabase/content/<course-slug>-hinglish/<NN>-<lesson-slug>.yaml`

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

### Step 7. Write the README

`out/README.md`, ten lines:

```markdown
# <Bundle title>

Generated by Claude Code on <date>.

## To apply:

1. cp -r out/supabase/ <ais-repo>/supabase/
2. Apply migration: supabase/migrations/<NNNN>_<slug>.sql
3. Run: npx tsx scripts/load-bundle-courses.ts
4. Apply: /tmp/bundles/<bundle-slug>.sql
5. Audio pipeline runs separately against the loaded lessons.

## Stats:
- Courses: N
- Lessons (EN): N
- Lessons (Hinglish): N
- Total turns: N
```

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

- Don't invent topics the source doesn't cover. Stay strictly within
  the source.
- Don't skip the brief. The brief is what makes the bundle survive
  session compaction.
- Don't author all lessons in parallel. Sequential authoring lets the
  brief evolve with the work.
- Don't insert anything into the DB. The YAMLs + the migration are the
  deliverable.
- Don't author audio.
- Don't generate images without confirming a connector is wired up.
- Don't use Devanagari for Hinglish.
- Don't use any persona name in lesson text. Second person only.
- Don't ship a bundle that hasn't passed the quality checklist.
