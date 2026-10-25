# Brief — Class 11 Physics · Ch.1 Units and Measurements (dual experience)

Source: **NCERT Class 11 Physics, Part I, Chapter 1 — Units and Measurements**
(rationalised syllabus; the old Ch.1 "Physical World" was dropped, so Units and
Measurements is now Chapter 1). Authored from standard NCERT content (operator
chose "use standard NCERT", no PDF supplied) — exam-standard definitions,
the SI base units, significant figures, errors in measurement, and dimensional
analysis.

## The dual-experience design — "Two doors, one chapter"

Operator ask: build a highly immersive, genuinely easy experience, in **two
versions** — one for learners who already know all prior-class concepts, one
for learners who don't. Decision: ship as **two separate bundles** (cleanest
fit for the content model — no in-lesson branching).

| | 🚀 Fast Track | 🌱 Ground-Up |
|---|---|---|
| slug | `…-fast` | `…-ground-up` |
| assumes | metric system, powers of ten, basic algebra/trig solid | **nothing** |
| approach | jumps to the new physics; leaner lessons; higher challenge | builds each prerequisite the moment it is needed (what a unit is, powers of ten, ratios, estimation); smaller steps; more worked examples + confidence checks |
| tone | respects prior mastery | "you already do this every day" — gentle, never assumes |
| tag | `track:fast-track` | `track:ground-up` |

Same destination (chapter mastery), same immersive spine, different on-ramp.
A learner picks their door on `/student`.

## Immersive spine (shared by both doors)

**"Pinning down reality."** The story of how humans went from body-part units
(a cubit) to atomic-clock precision — and the three superpowers it unlocks:

1. **A shared language** — the SI system, so a measurement means the same thing
   to everyone, everywhere.
2. **A lie-detector** — dimensional analysis, which catches a wrong formula from
   its units alone, before you plug in a single number.
3. **Honesty** — significant figures, errors, and orders-of-magnitude thinking:
   never claiming more precision than you actually have.

Recurring devices: the **powers-of-ten zoom** (quark → human → universe); **Fermi
estimation** games ("how many…?"); **"catch the fake formula"** dimension puzzles;
the **accuracy-vs-precision dartboard**.

## Visuals — inline SVG + CSS animation (NOT the cowork photo flow)

Physics needs *precise, labelled* diagrams (number lines, SI maps, dimensional
cancellations, error bars, the dartboard, powers-of-ten scales) — exactly the
thing AI image-generation garbles. So this chapter uses `svg_graphic` and
`html_animation` turns, which ship inside the lesson YAML with no external asset.
(A few real-object photos — a vernier caliper, Earth-from-space for scale — can
be added later as `media` turns if wanted.)

## Voice anchors

Same house voice as the other bundles (style anchor
`prime-factorization/01-...yaml`): direct second person; concrete before
abstract; ONE sustained metaphor per lesson; "what would break if X" framing;
opening hook is a question nobody asks in class; every checkpoint closes with
the question the next lesson opens. Persona `nova`. Ground-Up leans even more
concrete and never assumes a prior term without defining it first.

## Courses & lessons

### 🚀 Fast Track — `b-class-11-physics-ch01-units-and-measurements-fast`
Bundle-courses `17`, migration `0024`, order 600, 🚀 / `ember`.
- **Measuring Reality** (`measuring-reality`)
  1. What Is a Physical Quantity — quantities, units, fundamental vs derived, the need for a standard
  2. The SI System of Units — 7 base units + their constant-based definitions, derived units, practical units
  3. Orders of Magnitude — powers of ten, quark→universe, Fermi estimation
- **Honest Numbers** (`honest-numbers`)
  1. Significant Figures — counting rules, rounding
  2. Arithmetic with Significant Figures — operations, order of magnitude
  3. Errors in Measurement — accuracy vs precision; absolute/relative/percentage error; combination of errors
- **The Dimensional Lie-Detector** (`the-dimensional-lie-detector`)
  1. Dimensions and Dimensional Formulae
  2. Checking Equations with Dimensions — the principle of homogeneity
  3. Dimensional Analysis in Action — deriving relations, converting units, limitations

### 🌱 Ground-Up — `b-class-11-physics-ch01-units-and-measurements-ground-up`
Bundle-courses `18`, migration `0025`, order 601, 🌱 / `moss`.
- **Why We Measure** (`why-we-measure`)
  1. Measuring Without Rulers — what a unit even is; body parts → standards; why standardise
  2. The Powers of Ten Superpower — scientific notation from scratch; huge & tiny numbers
  3. Fundamental and Derived Units — gentle build to the SI base units
- **Numbers You Can Trust** (`numbers-you-can-trust`)
  1. How Sure Are You — precision, estimation, ratios (foundation)
  2. Significant Figures Made Simple
  3. Errors Without Fear — accuracy/precision, simple error ideas, concrete
- **Units as a Secret Code** (`units-as-a-secret-code`)
  1. Every Quantity Has a Shape — dimensions, intuitively
  2. Catching Wrong Formulas — homogeneity, concrete
  3. Using the Units Code — conversions & deriving simple relations

## Build decisions

- **Two bundles**, class:11, subject:physics, board:cbse, medium:[en], curriculum,
  plus `track:fast-track` / `track:ground-up`. English only this pass (Hinglish
  can be added later via the same `-hinglish` folder convention).
- **Base branch** `content/class10-geo-ch04` → keeps the student-curriculum
  migration lineage (0024/0025 after geo 0020–0023) and bundle-courses numbering
  (17/18 after 16).
- **Inline SVG / html_animation** for all diagrams; no cowork images, no audio
  worklist this pass.
- *(append after each lesson as authored)*

## How to apply
1. Apply migrations `0024` + `0025`.
2. `npx tsx scripts/load-bundle-courses.ts` → applies both bundles' course/lesson
   rows + syncs board/medium tags.
3. Load the lesson YAMLs via `scripts/load-content.ts`.
