# Authoring lessons

All lessons are **human-authored**. You write one YAML file per lesson. A loader turns them into rows in `lessons` + `lesson_turns`.

## Quick start

1. Pick the course slug from the list below (must match `courses.slug` exactly).
2. Create a file under `supabase/content/<course-slug>/NN-<lesson-slug>.yaml` — `NN` is a two-digit prefix (`01`, `02`, …) that drives the lesson's order within the course.
3. Write the lesson (see spec below).
4. `npm run content:load`.

The loader upserts the lesson row and **replaces** its turns in file order. Re-running is safe.

## File layout

```
supabase/content/
  AUTHORING.md
  chatgpt-basics/
    01-first-real-conversation.yaml
    02-build-your-first-gpt.yaml
  canva-magic/
    01-<slug>.yaml
```

- The directory name **is** the course slug.
- The filename prefix **is** the order index.

## Course slugs (seeded)

`chatgpt-basics`, `canva-magic`, `ai-basics`, `how-does-machine-learn`, `nlp-basics`, `how-does-ai-work`, `photo-editing-ai`, `insta-post-with-ai`, `what-is-ai`, `chatgpt-pro`, `design-with-canva-ai`, `all-in-one-gemini`, `translate-with-deepl`, `character-ai`, `perplexity-scholar`, `remove-bg-one-click`, `quillbot-rewrite`, `midjourney-art`, `prompt-engineering-14d`, `claude-deepthink`, `copilot-at-work`, `runway-video`, `zapier-automation`, `cursor-for-builders`, `kheti-mein-ai`, `ielts-success`, `neet-ug-prep`, `kirana-ai`, `ai-for-weddings`, `diet-planner`, `resume-ai`, `english-seekhna-ai-se`.

## Lesson file spec

Top-level fields mirror the `lessons` table.

```yaml
title: <string>                # required
subtitle: <string>             # optional
estimated_minutes: 10          # default 5
xp_reward: 40                  # default 20
turns:                         # required, at least one
  - ...
```

## XP

Every turn can award XP via an optional top-level `xp:` field. The loader writes it to `lesson_turns.xp_reward`. For `mcq` and `checkpoint` it also surfaces in the UI as a "+X XP" chip.

```yaml
- type: exercise
  xp: 20
  ...
```

Omit `xp` for turns that shouldn't award any (e.g. `tutor_message` usually has none).

## Turn types

Each turn has a `type` discriminator and shape. Eight types exist. Pick the right one — don't bend a type to fit something it isn't.

### 1. `tutor_message` — the tutor speaks

```yaml
- type: tutor_message
  persona: nova              # optional: nova | arjun | riya | sensei
  typing_ms: 1200            # optional, default 1200 (how long the "..." shows)
  text: |
    Most people type one-line questions and get mediocre answers.
    Sound familiar?
```

### 2. `mcq` — multiple choice

```yaml
- type: mcq
  xp: 15                     # awarded on correct answer
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

Any number of options ≥ 2. Multiple `is_correct: true` is fine — used for reflective-style MCQs.

### 3. `free_text` — AI-graded open answer

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

### 4. `reflection` — open answer, saved locally, not AI-graded

```yaml
- type: reflection
  xp: 5
  prompt: One sentence. What will you use ChatGPT for this week?
  placeholder: Write in your own words…
```

### 5. `exercise` — do-it-in-another-tab task

```yaml
- type: exercise
  xp: 20
  tool: chatgpt              # chatgpt | gemini | claude | midjourney | canva | any label
  instruction: |
    Open ChatGPT. Using RTCC, ask it to write a LinkedIn post
    announcing you're learning AI. Paste your prompt below.
  placeholder: Paste your prompt here…
```

### 6. `ai_conversation` — sub-chat with Claude playing the tutor

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

The sub-chat ends when `max_turns` is reached or Claude returns `<END/>`. Keep `max_turns` small (2–4).

### 7. `media` — image or video

```yaml
- type: media
  kind: image                # image | video
  url: https://dfdocnhhxrnvblbwwium.supabase.co/storage/v1/object/public/lesson-media/<file>
  caption: The ChatGPT sidebar, first time you open it.
  aspect_ratio: 1.77         # width/height (16/9 = 1.77)
```

Upload media to the `lesson-media` public bucket in Supabase Storage and paste the public URL.

### 8. `checkpoint` — end-of-lesson summary

```yaml
- type: checkpoint
  xp: 10
  title: You just learned RTCC.
  summary: |
    Role. Task. Context. Constraints. Every future prompt gets 5×
    better when you use it. Tomorrow — we build your first custom GPT.
```

Every lesson should end with one. It's the "cliffhanger" that sets up tomorrow.

## Voice guide (from the PRD)

- Italic for emphasis. **Never bold.** YAML: wrap with `*word*` or plain `<em>word</em>`.
- Em-dash without spaces: `learning is a practice—not an event`.
- Digits for counts: `3 tasks`, not `three tasks`. They render in tabular-nums.
- Tutor voice: warm but direct. "You're doing fine. One small thing —" not "Great job! 🎉".
- No "leverage", "empower", "elevate", "unlock your potential".
- Lowercase UI labels when referenced in lesson text (`"sign in"`, `"continue"`).
- Emojis are welcome inside lesson content. **Never** in UI chrome — that's a UI rule, not a content one.
- One rhetorical question per screen, max.

## Canonical example

See `chatgpt-basics/01-first-real-conversation.yaml` for a full 11-turn lesson covering every turn type.

## Running the loader

```bash
npm run content:load
```

Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Output:

```
chatgpt-basics/01-first-real-conversation.yaml
  ✓ 1 lesson · 11 turns

2 lessons · 23 turns · 0 errors
```

Safe to re-run — it's idempotent. Each lesson's turns are replaced in YAML order.

## Errors

The loader validates every file before touching the database. Typical failures:

- **Unknown course slug** — check the list above; create the file in the right directory.
- **Filename missing prefix** — rename to `NN-<slug>.yaml`.
- **`persona` must be nova | arjun | riya | sensei** — typo in the YAML.
- **`options` must have at least 2 entries** — MCQs need real choices.
- **`mcq` option missing `rationale`** — every option should explain itself.

Fix the YAML and re-run. No DB rows are written until the whole file validates.
