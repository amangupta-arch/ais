# Authoring lessons

Lessons are **AI-authored from a tiny human outline**. Humans write
`_outline.yaml` per course (~30 lines per course). The generator reads
it, calls Claude, and writes the full per-lesson YAML files.

The goal is teacher-grade depth — not a quiz wearing lesson clothes.

## Pipeline

```
_outline.yaml  ──►  scripts/generate-lesson.ts  ──►  NN-<slug>.yaml
                         (Claude opus-4-7)
                         (validates against schema, retries on fail)

NN-<slug>.yaml  ──►  npm run content:load  ──►  Supabase
```

Per-course directory layout:

```
supabase/content/
  AUTHORING.md
  _exemplar.yaml                # one hand-tuned reference lesson; few-shot anchor
  nlp-basics/
    _outline.yaml               # 10-lesson curriculum (human-edited)
    01-what-is-nlp.yaml         # AI-generated; do not hand-edit
    02-from-nlp-to-llm.yaml
    …
  chatgpt-basics/
    _outline.yaml
    01-first-real-conversation.yaml
    …
```

The loader regex is `NN-<slug>.yaml`, so `_outline.yaml` and
`_exemplar.yaml` are ignored automatically.

## Quick commands

```bash
# Regenerate one lesson
npm run content:generate -- --course=nlp-basics --slug=embeddings

# Regenerate every lesson in a course
npm run content:generate -- --course=nlp-basics --all

# Validate every YAML without writing to DB
npx tsx scripts/load-content.ts --dry-run

# Push validated YAML to Supabase
npm run content:load
```

## Depth floor (hard minimums every generated lesson must hit)

| Metric | Floor | Target |
|---|---|---|
| Total turns | 14 | 16–20 |
| `tutor_message` turns | 8 | 10–14 |
| Tutor text (chars, all turns combined) | 4,000 | 5,000–7,000 |
| Distinct turn types used | 5 | 6+ |
| `estimated_minutes` | 12 | 14–18 |
| Worked examples per major concept | 2 | 3+ |
| Misconceptions explicitly named & corrected | 1 | 2+ |
| Callbacks to prior lessons | 1 (when not lesson 01) | 2+ |

The generator measures these after parsing and retries with specific
feedback when a lesson falls below the floor.

## Pacing rule

No interactive turn (mcq, tap_to_match, drag_to_reorder,
fill_in_the_blank, free_text) before turn 5 unless it is `reflection`.

A concept gets the full beat:

```
hook  →  explain  →  analogy  →  worked example #1  →  worked example #2
     →  edge case / counter-example  →  misconception  →  quiz
```

Then the next concept. Three concepts per lesson is the typical
target — more makes the lesson too dense, fewer too thin.

## Mechanic mix rule

Every lesson uses at least 5 of the 11 turn types. The previous
authoring iteration leaned on the same 4 (tutor + mcq + tap_to_match +
fill_in_the_blank) for every lesson; the result was monotonous.

Lean into the underused mechanics:

- `ai_conversation` — Socratic mini-chat with Claude; great for
  prompting / RAG / "now you try"
- `exercise` — sends the learner to ChatGPT/Claude/Gemini in another
  tab to do the thing
- `free_text` — AI-graded open answer with a rubric; use sparingly
  but powerfully for "explain this back to me"
- `media` — image or video; best for diagrams of concepts
  (transformers, embeddings) when a hosted asset is available

## Voice (preserved from earlier guide)

- Italic for emphasis (`*word*`). **Never bold.**
- Em-dash without spaces: `learning is a practice—not an event`.
- Digits for counts: `3 tasks`, not `three tasks`.
- Tutor voice: warm but direct. "You're doing fine. One small
  thing —" not "Great job! 🎉".
- No "leverage", "empower", "elevate", "unlock your potential".
- Lowercase UI labels when referenced (`"sign in"`, `"continue"`).
- Emojis fine inside lesson content. Never in UI chrome.
- One rhetorical question per screen, max.
- Indian context where natural — Mumbai monsoon, biryani,
  Devanagari, ₹, Goa flights — but only when it lands.

## Outline file spec — `<course>/_outline.yaml`

The single source of human input. Edit this when you want to add,
remove, reorder, or re-scope lessons.

```yaml
course:
  slug: nlp-basics                  # must match courses.slug in DB
  title: NLP Basics
  audience: |
    Adult learners, no CS background. Indian context welcome.
    Comfortable with English, mixed-script writing fine.
  voice: |
    Nova — warm, direct, plain English. Short paragraphs.
    Italic for emphasis. Concrete examples over abstract claims.
  callback_policy: |
    Reference earlier lessons explicitly when a concept builds on
    one we've covered. e.g. "Remember tokens from lesson 03? Now —"

lessons:
  - prefix: "01"                    # filename order index
    slug: what-is-nlp               # final filename: 01-what-is-nlp.yaml
    target_minutes: 14
    target_xp: 50
    objectives:
      - Define NLP in one sentence a non-technical friend can repeat.
      - Distinguish NLP from "AI in general".
      - Name 4 NLP-powered products the learner already uses today.
    key_concepts:
      - what NLP is (and isn't)
      - the three hard things about language for computers
      - everyday NLP: search, autocomplete, translation, voice
    misconceptions_to_demolish:
      - "AI = LLMs" (NLP is older and broader)
      - "NLP only means chatbots"
    prerequisites: []               # other lesson slugs
  - prefix: "02"
    slug: from-nlp-to-llm
    …
```

## Lesson file spec (the AI-generated artefact)

Top-level fields mirror the `lessons` table:

```yaml
title: <string>                # required
subtitle: <string>             # optional
estimated_minutes: 14          # default 5 — must hit depth floor
xp_reward: 50                  # default 20
turns:                         # required, must hit depth floor
  - ...
```

## Turn types (11 total)

The generator must use these exactly. Each turn has a `type`
discriminator; the loader validates against `lib/content/schema.ts`.

### `tutor_message` — the tutor speaks

```yaml
- type: tutor_message
  persona: nova                # nova | arjun | riya | sensei
  text: |
    Most people type one-line questions and get mediocre answers.
    Sound familiar?
```

`typing_ms` and `reveal_style` are optional; defaults render fine.

### `mcq` — multiple choice

```yaml
- type: mcq
  xp: 15
  question: Which prompt gets a better answer?
  options:
    - id: a
      text: '"Write an email to my boss"'
      is_correct: false
      rationale: "Too thin. The AI has no idea what you want."
    - id: b
      text: '"Draft a 4-line email to my boss asking for 2 days off…"'
      is_correct: true
      rationale: "Context, constraint, tone, detail. Night and day output."
```

Every option must have a `rationale`. ≥ 2 options. `allow_multiple`
optional.

### `free_text` — AI-graded open answer

```yaml
- type: free_text
  xp: 10
  prompt: In one line, describe a task you do every week.
  placeholder: e.g. "replying to client status-update emails"
  min_chars: 20
  rubric: |
    A good answer names a specific, recurring task with clear
    inputs and outputs. Vague answers like "writing" don't count.
```

### `reflection` — open answer, saved locally

```yaml
- type: reflection
  xp: 5
  prompt: One sentence. What will you use ChatGPT for this week?
  placeholder: Write in your own words…
```

### `exercise` — do-it-in-another-tab task

```yaml
- type: exercise
  xp: 20
  tool: chatgpt                # chatgpt | gemini | claude | midjourney | canva | any label
  instruction: |
    Open ChatGPT. Using RTCC, ask it to write a LinkedIn post
    announcing you're learning AI. Paste your prompt below.
  placeholder: Paste your prompt here…
```

### `ai_conversation` — sub-chat with Claude as tutor

```yaml
- type: ai_conversation
  xp: 10
  goal: Help the user articulate a specific personal reason for learning AI.
  max_turns: 3
  success_criteria: The user names a concrete outcome.
  starter_text: |
    I'm your sparring partner for one minute. Tell me why you're
    learning AI, and I'll push back once. Ready?
  system_prompt: |
    You are Nova, a warm but direct coach. Ask the user why they're
    learning AI, then challenge their answer once to make it more
    specific. Keep replies under 40 words. After 2 exchanges, affirm
    and close with <END/>.
```

Keep `max_turns` small (2–4).

### `media` — image or video

```yaml
- type: media
  kind: image                  # image | video
  url: https://dfdocnhhxrnvblbwwium.supabase.co/storage/v1/object/public/lesson-media/<file>
  caption: The ChatGPT sidebar, first time you open it.
  aspect_ratio: 1.77           # width / height
```

Only use when an asset already exists in the `lesson-media` bucket —
the generator must not invent URLs.

### `checkpoint` — end-of-lesson summary

```yaml
- type: checkpoint
  xp: 10
  title: You just learned RTCC.
  summary: |
    Role. Task. Context. Constraints. Every future prompt gets 5×
    better when you use it. Tomorrow — we build your first custom GPT.
```

Every lesson ends with one. It's the cliffhanger that sets up next.

### `fill_in_the_blank` — typed answers inside a sentence

```yaml
- type: fill_in_the_blank
  xp: 15
  prompt: Fill in the four pieces of RTCC.
  template: "{{role}}, {{task}}, {{context}}, {{constraints}}"
  hint: All lowercase. Just the four words.
  answers:
    - id: role
      accepted: [role]
    - id: task
      accepted: [task]
    - id: context
      accepted: [context]
    - id: constraints
      accepted: [constraints, constraint]
```

Each `{{id}}` becomes an inline input. Matches are case-insensitive,
trimmed. List 2–4 common typos / synonyms in `accepted`.

### `drag_to_reorder` — put steps in the right sequence

```yaml
- type: drag_to_reorder
  xp: 15
  prompt: Drag these into the correct RTCC order.
  items:
    - id: t
      label: Task — what you want produced
    - id: r
      label: Role — who the AI should act as
    - id: c
      label: Context — background it needs
    - id: x
      label: Constraints — rules, length, tone
  correct_order: [r, t, c, x]
```

`correct_order` must list every `item.id` exactly once.

### `tap_to_match` — pair left to right

```yaml
- type: tap_to_match
  xp: 15
  prompt: Match each prompt-piece to its definition.
  left:
    - id: r
      label: Role
    - id: t
      label: Task
    - id: c
      label: Context
  right:
    - id: who
      label: Who the AI plays
    - id: what
      label: What it should produce
    - id: bg
      label: Background it should know
  pairs:
    - [r, who]
    - [t, what]
    - [c, bg]
```

`left.length == right.length == pairs.length`. The right column is
auto-shuffled at render time, so authored order doesn't matter.

## XP

Every turn accepts an optional `xp:` (non-negative int). The loader
maps it to `lesson_turns.xp_reward`. For `mcq` and `checkpoint` it
also surfaces in the UI as a "+X XP" chip.

Typical xp distribution per lesson:

- tutor_message: 0
- reflection: 5
- mcq / fill_in_the_blank / tap_to_match / drag_to_reorder: 10–15
- ai_conversation / exercise / free_text: 10–20
- checkpoint: 5–10

Total `xp_reward` (top-level) should equal the sum of per-turn xp.

## Course slugs (seeded)

`chatgpt-basics`, `canva-magic`, `ai-basics`, `how-does-machine-learn`,
`nlp-basics`, `how-does-ai-work`, `photo-editing-ai`, `insta-post-with-ai`,
`what-is-ai`, `chatgpt-pro`, `design-with-canva-ai`, `all-in-one-gemini`,
`translate-with-deepl`, `character-ai`, `perplexity-scholar`,
`remove-bg-one-click`, `quillbot-rewrite`, `midjourney-art`,
`prompt-engineering-14d`, `claude-deepthink`, `copilot-at-work`,
`runway-video`, `zapier-automation`, `cursor-for-builders`,
`kheti-mein-ai`, `ielts-success`, `neet-ug-prep`, `kirana-ai`,
`ai-for-weddings`, `diet-planner`, `resume-ai`, `english-seekhna-ai-se`.

## Errors from the loader

Validation runs before any DB write. Common failures:

- **Unknown course slug** — check the list above; the directory name
  must match `courses.slug` exactly.
- **Filename missing prefix** — rename to `NN-<slug>.yaml`.
- **`persona` must be nova | arjun | riya | sensei** — typo.
- **`options` must have at least 2 entries** — MCQs need real choices.

Re-run the generator (it'll see the validation error and retry) or fix
by hand, then `npm run content:load`.
