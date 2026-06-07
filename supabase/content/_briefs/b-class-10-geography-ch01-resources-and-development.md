# Brief — Class 10 Geography · Ch.1 Resources and Development

Source: **NCERT, *Contemporary India II* (Class 10 Geography), Chapter 1 —
Resources and Development** (Reprint 2026-27). Operator-supplied PDF.

| Field | Value |
|---|---|
| Bundle slug | `b-class-10-geography-ch01-resources-and-development` |
| Short name | `class10-geo-ch01` |
| Bundle-courses file | `supabase/content/bundle-courses/13-class10-geo-ch01.yaml` |
| Migration | `supabase/migrations/0020_student_plan_class10_geography.sql` |
| Emoji / gradient | 🌍 / `moss` |
| order_index | 410 (immediately after Class 10 Math at 400) |
| Plan tier | `student` |
| Tags | `class:10`, `subject:geography`, `board:cbse`, `medium:en`, `medium:hinglish`, `curriculum` |
| Boards / mediums (YAML) | `board: cbse` · `medium: [en, hinglish]` |

## Arc

Most students walk in believing resources are *free gifts of nature* —
lying around, waiting to be picked up. This chapter dismantles that. A
thing only becomes a *resource* when human ability reaches it: the
technology to use it, the economics to afford it, the culture to accept
it. From there the bundle widens out — we learn to *classify* any
resource four different ways, see why unchecked use breaks the planet and
what *sustainable development* and *resource planning* fix, then zoom into
the two resources we literally stand on: **land** and **soil** — how
India uses them, how they degrade, and how we conserve them. The shift in
understanding: from *"resources are out there"* to *"resources are made,
and they are ours to plan, share, and protect."*

## Bundle-wide anchors

- **Sustained metaphor (bundle):** *"Resources are made, not found."*
  Human technology + economy + culture is the machine that converts raw
  matter into a resource. The recurring image is the **three gates** a
  thing must pass through (technologically accessible → economically
  feasible → culturally acceptable) to earn the name "resource".
- **Recurring visuals:** the nature–technology–institutions triangle
  (NCERT Fig 1.1); the resource classification tree (Fig 1.2); an India
  outline with shaded regions for uneven resource distribution; the soil
  profile (Fig 1.5). All authored as inline `svg_graphic`. Motion via
  inline `html_animation` (CSS keyframes) — gif-like, ships in the YAML,
  no external assets. House style: confirmed that zero existing lessons
  use external image URLs; the trig lessons use `html_animation`.
- **Voice anchors (from the style anchor,
  `prime-factorization/01-...yaml`):** direct second person ("you", "we");
  concrete before abstract; ONE sustained metaphor per lesson; italics for
  *subtle distinctions*; "what would break if X" framing; opening hook is
  a question nobody asks in class; every checkpoint closes with the exact
  question the next lesson opens with. Persona `nova` on every
  `tutor_message`; never name the persona in text.

## Courses & lessons (full bundle — 3 courses, 10 lessons)

> **Pilot scope this session:** Course 1 only (4 lessons), EN + Hinglish.
> Courses 2–3 are defined in the bundle YAML so the catalogue knows the
> full shape; their lessons are authored in a later session.

### Course 1 — Resources and Resource Planning  *(slug: `resources-and-resource-planning`)*
Outcome: student can define what makes something a resource, classify any
resource by origin / exhaustibility / ownership / development, and explain
why planning and conservation matter.
1. **What Counts as a Resource** — the three tests (tech / economic /
   cultural); resources as a function of human activity; the
   nature–technology–institutions loop. *Metaphor: three gates.*
2. **Four Ways to Classify a Resource** — origin (biotic/abiotic),
   exhaustibility (renewable/non-renewable), ownership (individual/
   community/national/international), development status (potential/
   developed/stock/reserve). *Metaphor: four luggage tags on one suitcase.*
3. **Sustainable Development and Conservation** — over-use → depletion,
   haves/have-nots, ecological crises; sustainable development defined;
   Rio 1992 + Agenda 21; the conservation thinkers (Gandhi, Club of Rome
   1968, Schumacher 1974, Brundtland 1987). *Metaphor: borrowed, not
   inherited.*
4. **Resource Planning in India** — uneven distribution (Jharkhand,
   Arunachal, Rajasthan, Ladakh); the 3-step planning process; resources
   need technology + institutions (colonial lesson). *Metaphor:
   ingredients vs. the cooked meal.* Closes Course 1, bridges to Land.

### Course 2 — Land as a Resource  *(slug: `land-as-a-resource`)*  — NOT YET AUTHORED
Outcome: student can describe India's relief features, read the land-use
pattern, and explain the causes of land degradation and how to reverse them.
1. Land and Relief Features
2. How India Uses Its Land
3. Land Degradation and Conservation

### Course 3 — Soil as a Resource  *(slug: `soil-as-a-resource`)*  — NOT YET AUTHORED
Outcome: student can explain how soil forms, identify India's major soil
types and where they occur, and choose the right conservation method for a
given terrain.
1. How Soil Forms
2. The Soils of India
3. Soil Erosion and Conservation

## Photo slots (pending a connector — see below)

No image-generation MCP is wired, and the project config has no image
API key (only Supabase, Anthropic-text, ElevenLabs). Real photographs
need a *source*: public URLs, a Supabase `lesson-images` bucket, or an
image-gen key. Until then, NO `media` turns ship (a dead URL fails Zod /
404s at runtime). Inline SVG + html_animation carry every lesson. Intended
photo slots, to fill when a source exists:
- **C1 L1** — hook montage: uranium ore / a Rajasthan wind farm / coal
  seam ("which of these is a *resource*?").
- **C1 L3** — Rio de Janeiro Earth Summit 1992; optional Gandhi portrait
  for the conservation quote.
- Course 2–3 are the photo-rich ones (soil-type swatches, gully erosion,
  terrace farming) — prioritise the connector before authoring them.

## Audio

Nothing authored. `runAudioPipeline()` (`lib/audio/pipeline.ts`) runs
server-side after the YAML loads: extracts narratable text from turns,
strips markdown, synthesises via ElevenLabs (EN → Flash v2.5; Hinglish →
Hindi voice + multilingual_v2), content-addressable cache. Job ends at the
YAML.

## Decisions log

- **Course/lesson titles carry no colons or dashes** so `slugify` /
  `shortSlug` (lib/yaml-generation/catalog.ts) yields clean folder + file
  slugs. Verified: `resources-and-resource-planning`, `land-as-a-resource`,
  `soil-as-a-resource` don't collide with existing global course slugs.
- **`medium: [en, hinglish]`** in the bundle YAML (Math used `en` only) —
  Geography ships Hinglish from day one, so /student surfaces it to both
  the English and Hindi-medium cohorts.
- Migration owns `class:10 / subject:geography / curriculum`; the loader
  syncs `board:* / medium:*` from the YAML (mirrors the Math 0014 pattern,
  which kept `board` out of the migration).
- *(append after each lesson as authored)*

## Build status / how to apply

- **Authored so far:** scaffolding (this brief, bundle YAML, migration).
  Course 1 lessons: pending in this session.
- To apply once lessons land:
  1. `psql < supabase/migrations/0020_student_plan_class10_geography.sql`
     (or apply via Supabase migration tooling).
  2. `npx tsx scripts/load-bundle-courses.ts` → writes
     `/tmp/bundles/b-class-10-geography-ch01-resources-and-development.sql`;
     apply it.
  3. Load the lesson YAMLs via the content loader (`scripts/load-content.ts`
     / `npm run content:load`).
  4. Audio pipeline runs separately against the loaded lessons.
