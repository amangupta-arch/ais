# Brief — Class 10 Geography · Ch.4 Agriculture

Source: **NCERT, *Contemporary India II* (Class 10 Geography), Chapter 4 —
Agriculture** (Reprint 2026-27). Operator-supplied PDF (`jess104.pdf`, 12 pp).

> **Scope note (read first):** the Reprint 2026-27 of this chapter ends at
> *Technological and Institutional Reforms* + the *Bhoodan–Gramdan* box.
> It has **no** "Globalisation and Agriculture" / food-security section
> (present in older editions). We author strictly to this reprint — nothing
> on globalisation, gene revolution, organic farming, or the cotton-farmer
> case study, because this source doesn't carry them.

| Field | Value |
|---|---|
| Bundle slug | `b-class-10-geography-ch04-agriculture` |
| Short name | `class10-geo-ch04` |
| Bundle-courses file | `supabase/content/bundle-courses/16-class10-geo-ch04.yaml` |
| Migration | `supabase/migrations/0023_student_plan_class10_geo_ch04.sql` |
| Emoji / gradient | 🌾 / `ember` |
| order_index | 530 (after Ch.3 Water Resources at 520) |
| Plan tier | `student` |
| Tags | `class:10`, `subject:geography`, `board:cbse`, `medium:en`, `medium:hinglish`, `curriculum` |
| Boards / mediums (YAML) | `board: cbse` · `medium: [en, hinglish]` |
| Base branch | `content/class10-geo-ch03` (the geo content lineage — NOT `main`, whose migration numbering has diverged) |

## Arc

Two-thirds of India still lives off the land — yet "farming" is not one
thing. This chapter takes the student from the *shifting patch* a tribal
family slashes and burns to feed itself, through the *capital-heavy
plantation* that ships tea to the world, and shows that where a farm sits
on that spectrum is decided by population, climate, soil, markets and
policy. From there we learn India's *farming clock* — the Rabi, Kharif and
Zaid seasons — then walk the **geography of the crops**: why rice owns the
wet east and wheat the cool north-west, why the "coarse" millets feed the
dry lands, and where cotton, sugarcane, tea and pulses grow. We close on
the *fixing of the farm*: the technological and institutional reforms
(Green and White Revolutions, land reform, KCC, MSP) and the quiet story
of Vinoba Bhave's **Bhoodan–Gramdan** — land given, not taken. The shift
in understanding: from *"agriculture = growing food"* to *"agriculture is
a system — shaped by nature and people, and reformable."*

## Bundle-wide anchors

- **Sustained metaphor (bundle):** *"India farms in three gears."* The
  farming-systems spectrum (subsistence → commercial → plantation) is the
  spine; every crop and reform is read against *who the farm feeds and who
  it sells to.*
- **Recurring visuals:** the **farming-systems spectrum** (subsistence ↔
  commercial); the **cropping-calendar wheel** (Rabi / Kharif / Zaid); and
  **India crop-distribution maps** (rice, wheat, etc., mirroring NCERT's
  shaded "major / minor area" maps). Authored as inline `svg_graphic`;
  motion via inline `html_animation` (CSS keyframes, no external assets).
- **Voice anchors (from the style anchor,
  `prime-factorization/01-...yaml`):** direct second person; concrete
  before abstract; ONE sustained metaphor per lesson; italics for *subtle
  distinctions*; "what would break if X" framing; opening hook is a
  question nobody asks in class; every checkpoint closes with the exact
  question the next lesson opens with. Persona `nova` on every
  `tutor_message`; never name the persona in text.

## Hinglish register — BEHAVIOURAL (new standard, applies from this bundle)

Operator feedback on Ch.1–3: the Hinglish was *too tough* — it reached for
literary / Sanskritised Hindi (`purvaj`, `virasat`, `vyaakhya`, `sabhyata`,
`vividh`, `anginat`, `samjhauta`, `rajya`, `vyaapak roop se`). Ch.4 Hinglish
must be **behavioural** — the register a real bilingual tutor *speaks*:

1. **English-first for nouns & concepts.** If an educated bilingual
   student would say the word in English, keep it English (ancestors,
   civilisation, explanation, state, diverse, balance, compromise,
   countless, target, widely, mainly) — do **not** Sanskritise it.
2. **Hindi only for the glue** — verbs, pronouns, postpositions,
   connectors (hai, hota hai, karte hain, dekho, socho, matlab, lekin,
   kyunki, toh, bas, thoda).
3. **Spoken, not written.** Short sentences; tutor fillers (matlab,
   basically, dekho, right?). Read it aloud — if it sounds like a news
   anchor, it's too tough.
4. **Everyday Hindi word, never the literary one.** No poetic verbs
   (`jhulaste`, `taraste`); plain word or English instead.
5. **Never translate technical/modern terms** (resource, crop, season,
   irrigation, fertiliser, revolution, market) — stay English.
6. **Glosses sparingly**, English → *simple* Hindi only when it genuinely
   helps; never gloss into a harder word.
7. **Meaning stays 1:1 with English.** Behavioural ≠ loose — same facts,
   numbers, states, emphasis.

(A wider decision — whether to retrofit Ch.1–3's `-hinglish` YAMLs to this
register and regen their audio worklists — is pending operator go. The
Ch.1 Hinglish *audio* worklist already in Drive uses the OLD register, so
cowork should record the EN clips first and HOLD Hinglish until retrofit.)

## Courses & lessons (full bundle — 3 courses, 9 lessons)

### Course 1 — Farming Systems and Seasons  *(slug: `farming-systems-and-seasons`)*
Outcome: student can tell India's farming systems apart (subsistence vs
commercial vs plantation) and place crops in the Rabi, Kharif and Zaid seasons.
1. **Subsistence Farming** — primitive subsistence (slash-and-burn /
   *jhumming*; hoe, dao, digging sticks; monsoon + natural soil fertility;
   low productivity; shifting lets the soil recover; the many Indian names
   — Bewar/Dahiya, Podu/Penda, Kumari, Khil, Kuruwa — and world names —
   Milpa, Roca, Ladang) **and** intensive subsistence (high population
   pressure; labour + biochemical inputs + irrigation; right of inheritance
   → land fragmentation → uneconomical holdings). *Metaphor: farming to eat,
   not to sell; the shifting patch.*
2. **Commercial and Plantation Farming** — modern inputs (HYV seeds,
   chemical fertilisers, insecticides, pesticides); commercialisation
   varies by region (rice is commercial in Punjab/Haryana, subsistence in
   Odisha); **plantation** as a type of commercial farming (single crop,
   large area, capital-intensive, migrant labour, produce → industrial raw
   material; tea, coffee, rubber, sugarcane, banana; needs a transport +
   communication network). *Metaphor: the factory in the field.*
3. **The Cropping Calendar** — Rabi (sown Oct–Dec, harvested Apr–Jun;
   wheat, barley, peas, gram, mustard; north & NW; western temperate
   cyclones; green-revolution states), Kharif (onset of monsoon → harvested
   Sep–Oct; paddy, maize, jowar, bajra, tur, moong, urad, cotton, jute,
   groundnut, soyabean; rice regions; Aus/Aman/Boro in Assam/WB/Odisha),
   Zaid (short summer; watermelon, muskmelon, cucumber, vegetables, fodder;
   sugarcane ~ a year). *Metaphor: India's farming clock.*

### Course 2 — The Crops of India  *(slug: `the-crops-of-india`)*
Outcome: student can name India's major crops, the geographical conditions
each needs, and where in India each is grown.
1. **The Two Staples: Rice and Wheat** — rice (staple; India 2nd after
   China; kharif; >25°C, high humidity, >100cm, else irrigation; N/NE,
   coastal, deltaic; canal+tubewell extended it to Punjab/Haryana/W.UP/
   Rajasthan) and wheat (2nd cereal; rabi; cool growing + bright ripening
   sun; 50–75cm even rainfall; Ganga-Satluj plains + Deccan black soil;
   Punjab, Haryana, UP, MP, Bihar, Rajasthan). *Metaphor: the two halves of
   the Indian plate — wet east vs cool north-west.*
2. **Millets, Maize and Pulses** — jowar (rain-fed; Maharashtra, Karnataka,
   AP, MP), bajra (sandy/shallow black; Rajasthan, UP, Maharashtra, Gujarat,
   Haryana), ragi (dry regions; iron/calcium-rich; Karnataka, TN, HP,
   Uttarakhand, Sikkim, Jharkhand, Arunachal); maize (food + fodder; kharif,
   21–27°C, old alluvial; rabi in Bihar; Karnataka, MP, UP, Bihar, AP,
   Telangana); pulses (India largest producer + consumer; protein;
   leguminous, fix nitrogen, grown in rotation; MP, Rajasthan, Maharashtra,
   UP, Karnataka). *Metaphor: the tough crops that grow where rice and wheat
   give up.*
3. **Cash Crops and Beverages** — sugarcane (tropical/subtropical, 21–27°C,
   75–100cm; India 2nd after Brazil; sugar/gur/khandsari/molasses; UP,
   Maharashtra, Karnataka, TN…), oil seeds (~12% of cropped area;
   groundnut/mustard/sesamum/soyabean/castor; groundnut ~half, Gujarat
   leads), tea (plantation; British origin, now Indian-owned; deep humus
   soil, frost-free, frequent showers, cheap skilled labour; Assam,
   Darjeeling, TN, Kerala…; 2nd after China), coffee (Arabica from Yemen via
   Baba Budan Hills; Nilgiri — Karnataka, Kerala, TN), horticulture (2nd
   after China; mangoes, oranges, bananas, apples, etc.). *Metaphor: the
   crops we sell and sip.*
4. **Fibres and Rubber** — non-food framing; rubber (equatorial; >200cm,
   >25°C; Kerala, TN, Karnataka, A&N, Meghalaya Garo Hills); fibre crops
   (cotton, jute, hemp, silk; silk = sericulture); cotton (India's original
   cotton home; 2nd after China; drier black soil of Deccan; kharif, 6–8
   months, 210 frost-free days; Maharashtra, Gujarat, MP…), jute (golden
   fibre; flood-plain renewed soils; WB, Bihar, Assam, Odisha, Meghalaya;
   gunny bags, ropes, mats). *Metaphor: the crops we wear and bounce.* Closes
   the crop tour.

### Course 3 — Reforms and the Way Forward  *(slug: `reforms-and-the-way-forward`)*
Outcome: student can explain the technological and institutional reforms
that reshaped Indian agriculture, and retell the Bhoodan–Gramdan movement.
1. **Technological and Institutional Reforms** — why reform (no
   techno-institutional change hindered development; >60% depend on
   agriculture); post-Independence institutional reforms (collectivisation,
   consolidation of holdings, cooperation, abolition of zamindari; land
   reform = focus of First Five Year Plan; inheritance → fragmentation);
   1960s–70s Green Revolution (package technology) + White Revolution
   (Operation Flood) → concentrated in a few areas; 1980s–90s comprehensive
   land-development programme (crop insurance vs drought/flood/cyclone/fire/
   disease; Grameen banks, cooperative banks at low interest); KCC, PAIS;
   weather bulletins on radio/TV; MSP + procurement prices vs speculators/
   middlemen. *Metaphor: fixing the farm — new tools vs new rules.*
2. **Bhoodan–Gramdan: The Bloodless Revolution** — Gandhi names Vinoba
   Bhave his spiritual heir; *gram swarajya*; after Gandhi's martyrdom the
   *padyatra*; Pochampally (Telangana) landless villagers ask for land; Shri
   Ram Chandra Reddy offers 80 acres → **Bhoodan**; whole villages offered →
   **Gramdan**; some land-owners give from fear of the land-ceiling act;
   the **Blood-less Revolution**. *Metaphor: land as a gift, not a seizure.*

## Photo slots (pending operator image deploy)

Following Ch.1–3: inline SVG + html_animation carry every lesson; real
photos ship later via the operator's cowork → Supabase `lesson-images`
flow (I emit prompts; operator generates; `scripts/upload-lesson-images.ts`
→ public URLs; I add `media` turns). NO `media` turns ship until a source
URL exists (a dead URL fails Zod / 404s). High-value photo slots:
jhumming hillside (C1L1); a tea/banana plantation (C1L2); rice paddy vs
wheat field (C2L1); a cotton boll / jute retting (C2L4); Vinoba Bhave on
padyatra (C3L2).

## Audio

Nothing authored. Narration is a post-load step (`runAudioPipeline`,
ElevenLabs) — or, per the current operator workflow, an external cowork
generation driven by an emitted worklist (`scripts/emit-audio-worklist.ts`),
EN = Flash v2.5, Hinglish = Hindi voice on multilingual_v2. **Author the
Hinglish in the behavioural register above** so the worklist text is right
the first time.

## Decisions log

- **Base = `content/class10-geo-ch03`, not `main`.** The geo chapters are a
  separate content lineage; `main`'s `0020–0023` are unrelated rate-limit /
  RLS migrations. Basing here keeps the `0020/0021/0022 → 0023` geo
  migration sequence and `13/14/15 → 16` bundle-courses numbering intact and
  avoids a migration-number collision.
- **Course/lesson titles carry no colons/dashes** so `slugify` yields clean
  slugs (`farming-systems-and-seasons`, `the-crops-of-india`,
  `reforms-and-the-way-forward`). Lesson "The Two Staples Rice and Wheat" →
  check slug; title is written without a colon in the YAML.
- **9 lessons (3+4+2)** matches Ch.2/Ch.3's size. Crops gets 4 lessons
  because it's the chapter's bulk; Reforms gets 2 (reforms + the
  Bhoodan-Gramdan story, which the source gives a full box).
- **`medium: [en, hinglish]`** from day one (mirrors Ch.1–3).
- *(append after each lesson as authored)*

## Build status / how to apply

- **Authored so far:** scaffolding (this brief, bundle YAML, migration).
  Lessons: pending.
- To apply once lessons land (mirrors Ch.1–3):
  1. Apply migration `0023_student_plan_class10_geo_ch04.sql`.
  2. `npx tsx scripts/load-bundle-courses.ts` → applies the bundle/course
     rows + syncs `board:* / medium:*` tags.
  3. Load the lesson YAMLs via `scripts/load-content.ts`.
  4. (Later) emit + run the image and audio worklists.
