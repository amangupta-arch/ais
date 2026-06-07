# Brief — Class 10 Geography · Ch.2 Forest and Wildlife Resources

Source: **NCERT, *Contemporary India II* (Class 10 Geography), Chapter 2 —
Forest and Wildlife Resources** (Reprint 2026-27, rationalised edition).
Operator-supplied PDF (`jess102`). The rationalised chapter is compact:
biodiversity → conservation (Wildlife Act, Project Tiger) → forest types →
community conservation. We stay strictly within it (no IUCN species table,
no depletion-causes table, no cheetah/yew boxes — those were cut).

| Field | Value |
|---|---|
| Bundle slug | `b-class-10-geography-ch02-forest-and-wildlife-resources` |
| Short name | `class10-geo-ch02` |
| Bundle-courses file | `supabase/content/bundle-courses/14-class10-geo-ch02.yaml` |
| Migration | `supabase/migrations/0021_student_plan_class10_geo_ch02.sql` |
| Emoji / gradient | 🐯 / `moss` |
| order_index | 510 (Geography lane; Ch.1 = 500) |
| Plan tier | `student` |
| Boards / mediums | `board: cbse` · `medium: [en, hinglish]` |
| Branch | `content/class10-geo-ch02` (clean, ch02 only) |

## Arc

India is one of the richest countries on Earth for biodiversity — a *web
of life* that quietly remakes the air we breathe, the water we drink, and
the soil that feeds us. We are one strand in that web, not above it. But
the web is under stress. This chapter is the story of protecting it: why
biodiversity is worth saving, how the *state* protects forests and wildlife
(the Wildlife Protection Act, Project Tiger, the three classes of forest),
and — the heart of the chapter — how *communities*, not just governments,
have always conserved nature (Chipko, sacred groves, joint forest
management). The shift: from "nature is a backdrop" to "we are part of a
web we must actively protect, together."

## Bundle-wide anchors

- **Sustained metaphor (bundle):** the **web of life** — pull one strand
  and the whole web trembles; we are *in* the web, dependent on it.
- **Per-lesson metaphors:** web/Jenga (C1L1); a living library, books yet
  unread (C1L2); life-support system + seed bank (C1L3); a legal shield
  (C2L1); the tiger as umbrella species — save the tiger, save the forest
  (C2L2); three tiers of guardianship (C2L3); the forest's neighbours are
  its best guards (C3L1); farming *with* nature, not against (C3L2); the
  forest as a temple — reverence conserves (C3L3).
- **Visuals:** inline `svg_graphic` (web diagram, tiger-decline bar,
  forest-type tiers, sacred-species panel) + `html_animation` (web
  trembling, the 55,000→1,827 tiger drop, tiers stacking). Real photos via
  the cowork→Drive flow (tiger, Kaziranga rhino, Chipko, sacred grove).
- **Voice:** Nova — direct second person, one metaphor per lesson,
  concrete-before-abstract, "what would break if X", hook = a question
  nobody asks, checkpoint closes with the next lesson's opening question.
  Persona `nova` on every `tutor_message`; never name the persona.

## Courses & lessons (3 courses, 9 lessons)

### Course 1 — Biodiversity and the Web of Life  *(slug: `biodiversity-and-the-web-of-life`)*
Outcome: student can define biodiversity, explain why humans depend on it,
and give concrete reasons conservation matters.
1. **We Are One Strand in the Web** — biodiversity, the ecological web, our
   dependence, forests as primary producers.
2. **India's Living Wealth** — India among the world's richest in flora and
   fauna; integrated in daily life; under stress.
3. **Why Conservation Matters** — life-support systems (air/water/soil),
   genetic diversity, dependence of agriculture and fisheries.

### Course 2 — Protecting Forests and Wildlife  *(slug: `protecting-forests-and-wildlife`)*
Outcome: student can explain how India protects wildlife in law, the story
of Project Tiger, and the three classes of forest.
1. **The Wildlife Protection Act** — 1972 Act, national parks/sanctuaries,
   the protected-species list, the named animals.
2. **Project Tiger** — the tiger's collapse (55,000 → 1,827), the threats,
   Project Tiger (1973), the tiger reserves, widening to biodiversity.
3. **Reserved, Protected, and Unclassed Forests** — the three categories,
   permanent forest estates, the state-wise pattern.

### Course 3 — Communities and Conservation  *(slug: `communities-and-conservation`)*
Outcome: student can describe how Indian communities conserve forests and
wildlife, and why community involvement is essential.
1. **When Villages Defend the Forest** — Sariska, the Bhairodev Dakav
   'Sonchuri' (Alwar), the Chipko movement.
2. **Farming with Nature** — Beej Bachao Andolan, Navdanya, joint forest
   management (JFM, since 1988).
3. **Sacred Groves** — nature worship, sacred trees/animals, the Bishnoi,
   the deeper lesson of people-centred conservation (Buddha's tree quote).
   Final lesson — closes the whole bundle.

## Decisions log

- Course/lesson titles carry no colons; lesson "Reserved, Protected, and
  Unclassed Forests" keeps a comma (slugifies cleanly to
  `reserved-protected-and-unclassed-forests`).
- Source is the **rationalised** chapter — deliberately omits the IUCN
  species categories, depletion-causes table, and Asiatic-cheetah / Yew
  boxes (cut from NCERT). Don't reintroduce them.
- Migration owns `class:10 / subject:geography / curriculum`; loader syncs
  `board:* / medium:*` from the YAML (matches Ch.1 / Math pattern).
- `medium: [en, hinglish]`; Hinglish folders carry a `_lang.yaml` marker.
- SVG/HTML markup kept verbatim in Hinglish; only `title`/`caption` + prose
  translated. Roman-script Hinglish, no Devanagari.

## Audio / Images

- **Audio:** nothing authored — generated post-load by `runAudioPipeline`
  (ElevenLabs). EN → flash_v2_5; Hinglish → Hindi voice on multilingual_v2.
- **Images:** no inline `media` turns until real files exist. Prompts go to
  Drive `cowork_images/class10-geo-ch02-courseN.md`; cowork generates into
  `class10-geo-ch02-courseN/`; media turns wired from the deterministic
  `lesson-images/<bundle-slug>/<file>` URL once PNGs land.

## How to apply (deploy session)

1. Migration `0021_student_plan_class10_geo_ch02.sql` (bundle insert).
2. `npx tsx scripts/load-bundle-courses.ts` → apply the generated
   `/tmp/bundles/b-class-10-geography-ch02-...sql`.
3. Content loader for the 18 lesson YAMLs.
4. Images → `lesson-images` bucket; audio → `runAudioPipeline`.
