# Lesson YAML — Knowledge Pack for Claude

You are generating a **lesson YAML** for the AIS learning app. Read this entire file before writing anything. The YAML you produce will be pasted into the `/update-yaml` form (or saved as `supabase/content/<course>/NN-<slug>.yaml`) and validated by a Zod schema. If validation fails, **the lesson is rejected wholesale** — no partial loads.

---

## 1. The shape of a lesson

A lesson is a single YAML document with these top-level keys:

```yaml
title: "string, required"               # shown in the lesson player header
subtitle: "string, optional"            # shown under the title
estimated_minutes: 5                    # int, default 5
xp_reward: 20                           # int, default 20 — awarded on lesson complete
turns:                                  # array, required, must have ≥1 turn
  - { type: tutor_message, ... }
  - { type: mcq, ... }
  - { type: checkpoint, ... }           # last turn MUST be a checkpoint
```

**Rules that get violated most often (Claude's default failure modes):**

1. **Last turn must be `type: checkpoint`.** Without it the Complete CTA never renders and the user can't finish the lesson.
2. **Every `id:` field across `mcq.options`, `fill_in_the_blank.answers`, `drag_to_reorder.items`, `tap_to_match.left/right` must be lowercase, hyphenated, alphanumeric.** No spaces, no uppercase, no underscores. Use `a, b, c, d` for MCQ options.
3. **Exactly one MCQ option per question must have `is_correct: true`.** Don't make multiple correct unless the question explicitly asks "select all that apply" — and even then, prefer rewriting it.
4. **`tap_to_match` must be bijective:** `left.length === right.length === pairs.length`, every left id and every right id appears in exactly one pair. Mismatched lengths = validation error.
5. **`drag_to_reorder.correct_order` must list every `items[].id` exactly once.** Same length, same ids.
6. **`xp` is a per-turn field** (where allowed), not nested. Top-level `xp_reward` is the lesson completion reward.
7. **Use the YAML `|` block scalar** for any text longer than ~80 chars or containing newlines, asterisks, colons, or quotes. It's far safer than inline strings.

---

## 2. Turn types — full reference

Each turn object has a `type` discriminator. Below: every type, every field, every constraint.

### `tutor_message` — narrator dialogue with avatar

```yaml
- type: tutor_message
  persona: nova                 # optional: nova | arjun | riya | sensei (default: lesson default)
  typing_ms: 800                # optional int >0 — typing-dot delay before text
  reveal_style: fade            # optional: fade | typewriter
  text: |
    The line(s) the tutor speaks. Markdown-lite: *italic*, **bold**, lists.
    Use \n\n for paragraph breaks (in `|` block, just blank lines).
  xp: 0                         # optional, usually omitted
```

**Use for:** explanations, transitions, jokes, hooks, summaries before exercises.
**Style:** short paragraphs (2–4 sentences). Each tutor_message is one bubble. 5–10 bubbles in a row is normal — easier to read than one giant wall of text.

### `mcq` — multiple choice

```yaml
- type: mcq
  xp: 15                        # awarded on correct answer
  question: "Plain question, no leading 'Q:'."
  allow_multiple: false         # optional, default false
  options:
    - id: a
      text: "Option A text"
      is_correct: true
      rationale: "Why this is right (or wrong) — shown after the user picks this option."
    - id: b
      text: "Option B text"
      is_correct: false
      rationale: "Why this is wrong."
    - id: c
      text: "Option C text"
      is_correct: false
```

**Constraints:** ≥2 options. Each `id` unique within the question. Exactly one `is_correct: true` (unless `allow_multiple: true`). Rationale is optional but ALWAYS WRITE ONE — it's the teaching moment.

### `free_text` — open-ended typed answer

```yaml
- type: free_text
  xp: 10
  prompt: "Write a 2-sentence intro about yourself."
  placeholder: "I'm…"           # optional input placeholder
  min_chars: 30                 # optional int >0; submit disabled below this
  rubric: "What good looks like" # optional, not currently shown to user
```

**Use for:** practice writing, prompt-engineering exercises, name/topic capture. No correctness check — XP awarded on submit.

### `reflection` — like free_text but contemplative

```yaml
- type: reflection
  xp: 5
  prompt: "What's one thing you'll try this week?"
  placeholder: "Optional"
```

**Use for:** mid-lesson pauses, end-of-section reflections. No min_chars enforced.

### `exercise` — try-it-in-tool task

```yaml
- type: exercise
  xp: 25
  tool: chatgpt                 # optional but recommended
  instruction: |
    Open ChatGPT. Paste this RTCC prompt. Edit it for YOUR job, your boss, your week.
    Send it. Save the reply.
  placeholder: "Paste the reply here"
```

**Special behavior:** if `tool` is `chatgpt`, `claude`, `gemini`, or `perplexity`, the lesson player renders an **in-app practice chat** instead of asking the user to leave to an external tab. For any other tool (`canva`, `midjourney`, `excel`, `figma`, etc.) it shows an external-tool prompt + textarea.

### `ai_conversation` — in-app sub-chat with goal

```yaml
- type: ai_conversation
  xp: 30
  goal: "Get a 5-line LinkedIn intro you'd actually post."
  max_turns: 6                  # int >0 — caps the back-and-forth
  success_criteria: "User has a final intro they explicitly approve."
  starter_text: "Hi! I'm here to help you draft a LinkedIn intro. Tell me your role and one accomplishment."
  system_prompt: |
    You are a friendly career coach. Help the user iterate on their LinkedIn
    intro. After 4–5 turns, ask if they're happy with it. If yes, end with
    "🎉 Looks great. Save that one."
```

**Use sparingly** — these cost API credits and take time. One per lesson max. Reserve for the highest-leverage practice moment.

### `media` — image or video block

```yaml
- type: media
  kind: image                   # image | video
  url: "https://example.com/file.png"
  caption: "Optional caption shown below."
  aspect_ratio: 1.7777          # optional number; e.g. 16/9 = 1.7778
  xp: 0
```

**Constraints:** `url` must be a valid URL. Image URLs render via `<img>`, video via `<video controls>`. Use Supabase storage URLs or other public CDN.

### `checkpoint` — end-of-lesson card (REQUIRED as last turn)

```yaml
- type: checkpoint
  xp: 0                         # checkpoint xp is usually 0; lesson xp_reward fires on Complete
  title: "You learned the RTCC framework."
  summary: |
    You can now structure any prompt with Role, Task, Context, Constraints —
    and you've seen the 5× quality jump it gives. Next: turning RTCC into muscle
    memory across email, code, and research workflows.
```

**Always include exactly ONE checkpoint, as the LAST turn.** Multiple checkpoints break the Complete CTA logic. Title should celebrate; summary should bridge to what's next.

### `fill_in_the_blank` — type the missing word(s)

```yaml
- type: fill_in_the_blank
  xp: 15
  prompt: "Complete the sentence:"
  template: "The capital of France is ___."
  hint: "It's a famous European city."   # optional
  answers:
    - id: blank-1
      accepted: ["Paris", "paris", "PARIS"]   # case variants and synonyms; first is canonical
```

**Constraints:** `template` must contain `___` (three underscores) where each blank goes — one per `answers[]` entry, in order. Each `accepted` array must have ≥1 string. List all reasonable spelling/case variants; the comparison is exact-match.

### `drag_to_reorder` — sort items into order

```yaml
- type: drag_to_reorder
  xp: 15
  prompt: "Put the prompt-engineering steps in order."
  items:
    - { id: i1, label: "Set the Role" }
    - { id: i2, label: "Define the Task" }
    - { id: i3, label: "Add Context" }
    - { id: i4, label: "Set Constraints" }
  correct_order: [i1, i2, i3, i4]
```

**Constraints:** ≥2 items. `correct_order` must list every `items[].id` exactly once.

### `tap_to_match` — bijective pairing

```yaml
- type: tap_to_match
  xp: 15
  prompt: "Match each model to its strength."
  left:
    - { id: l1, label: "Claude" }
    - { id: l2, label: "Midjourney" }
    - { id: l3, label: "ElevenLabs" }
  right:
    - { id: r1, label: "Long-form writing" }
    - { id: r2, label: "AI images" }
    - { id: r3, label: "AI voice" }
  pairs:
    - [l1, r1]
    - [l2, r2]
    - [l3, r3]
```

**Constraints:** `left.length === right.length === pairs.length`. Every left id and every right id appears in exactly one pair. No duplicates.

### `svg_graphic` — inline SVG figure

```yaml
- type: svg_graphic
  xp: 0
  title: "RIGHT TRIANGLE"           # optional, shown as eyebrow above the figure
  caption: "The hypotenuse is always opposite the right angle."  # optional
  svg: |
    <svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,140 180,140 180,40" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
      <text x="100" y="155" text-anchor="middle" font-size="14">base</text>
    </svg>
```

**Use for:** geometry diagrams, charts, simple infographics. The SVG is rendered with `dangerouslySetInnerHTML` — TRUSTED AUTHOR ONLY (no user input flows here). Use `viewBox` so it scales; the container is ~100% width.

### `html_animation` — inline HTML/CSS animation

```yaml
- type: html_animation
  xp: 0
  title: "PYTHAGORAS IN MOTION"
  caption: "Watch a² + b² assemble into c²."
  html: |
    <style>
      .box { width: 100%; aspect-ratio: 16/9; background: #f3f4f6; }
      @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
      .gear { animation: spin 2s linear infinite; }
    </style>
    <div class="box">
      <div class="gear">…</div>
    </div>
```

**Use sparingly.** Same trust model as `svg_graphic`. Self-contained `<style>` block is fine; no external scripts. Keep it short — long HTML is a maintenance burden.

---

## 3. Authoring philosophy

The brand voice across the app is **Nova — warm, patient, never rushes, asks good questions**. Other personas exist (Arjun = direct/demanding; Riya = chill, Hinglish; Sensei = old-school discipline) but use Nova by default unless the lesson explicitly calls for someone else.

### Lesson rhythm

A great lesson has a **predictable rhythm**:

1. **Hook** (1–2 tutor_messages) — name the problem, promise the payoff
2. **Concept** (3–6 tutor_messages) — explain the idea in small bites with metaphors
3. **Show, don't tell** (1–2 examples, often paired tutor_messages) — concrete before/after
4. **Check** (1 mcq or fill_in_the_blank) — does the concept land?
5. **Apply** (1 free_text or exercise) — make the user use it
6. **Optional twist** (1 game-y mechanic — drag_to_reorder, tap_to_match, ai_conversation) — variety
7. **Checkpoint** — celebrate + bridge to next lesson

Aim for **12–20 turns total**. Under 8 feels thin; over 25 is exhausting on mobile.

### Tone rules

- **Short paragraphs.** Each tutor_message is a small thought. White space is your friend.
- **Talk TO the user, not AT them.** "You" not "the learner." "Try this" not "Users should try."
- **Concrete > abstract.** Always include a real example, never just principles.
- **Show the bad version first.** Then the good version. The contrast does the teaching.
- **Italics for emphasis** (sparingly), `**bold**` for keywords on first appearance.
- **No emojis** (unless the lesson is explicitly playful and the user's brand allows it).
- **Numbers in figures** when possible: "5× faster" beats "much faster."

### XP guidelines

Total turn XP should sum to roughly the lesson's `xp_reward` divided by 2 — the rest comes from the completion bonus. Rule of thumb:

- `tutor_message`: 0
- `media`, `svg_graphic`, `html_animation`, `checkpoint`: 0
- `mcq`, `fill_in_the_blank`, `drag_to_reorder`, `tap_to_match`: 5–15
- `free_text`, `reflection`: 5–10
- `exercise`: 15–25
- `ai_conversation`: 20–40

Lesson `xp_reward` typically 60–120 for a normal lesson, up to 200 for a meaty one.

---

## 4. Translation hand-off

If the user asks for the same lesson in another language (Hindi, Hinglish, Marathi, Punjabi, Telugu, Tamil, Bengali, French, Spanish):

- **Same lesson slug** as the canonical.
- **Same overall structure** (you can change turn count if it makes pedagogical sense — 16 EN turns can become 12 HI turns when the explanation is more efficient in another language).
- **Translate `title`, `subtitle`, all `text`, all `prompt`, all `question`, all option `text`, all `rationale`, all `caption`, all `summary`, all `goal`, all `success_criteria`, all `starter_text`, all `system_prompt`, all `instruction`, all `label`.**
- **Do NOT translate:** `id` values (they're join keys), `tool` names, persona names (`nova`, `arjun` etc.), URLs, SVG/HTML markup contents (translate only visible text labels inside).
- **Do NOT translate:** technical terms that are universally English in that locale (e.g. "ChatGPT", "Python", "Excel"). Hinglish especially leans on English nouns.

---

## 5. Worked example — a small but complete lesson

Use this as a template for shape, not for content.

```yaml
title: "RTCC — your first prompt framework"
subtitle: "Why most prompts fail, and the 4-letter checklist that fixes them"
estimated_minutes: 8
xp_reward: 90

turns:
  - type: tutor_message
    persona: nova
    text: |
      Hey. Let's fix a problem you didn't know you had.

      You've probably typed a one-line prompt into ChatGPT and felt let down by the reply. *"This is fine. Why is everyone losing their minds?"*

  - type: tutor_message
    persona: nova
    text: |
      The model isn't underwhelming. *Your prompt was.*

      Most people give the AI almost nothing — and judge it on what comes back.

  - type: tutor_message
    persona: nova
    text: |
      The fix is a 4-letter checklist. *RTCC.*

      - **R** — Role. Who should the AI pretend to be?
      - **T** — Task. What exactly do you want?
      - **C** — Context. What does it need to know?
      - **C** — Constraints. Length, tone, format.

  - type: tutor_message
    persona: nova
    text: |
      Watch the gap. Same task, two prompts.

      *Bad:* "Write an email asking for two days off."
      *RTCC:* "Act as a confident, no-fluff communicator (Role). Write a 4-line email asking my manager for 2 days off (Task) — Friday + Monday next week, family wedding (Context). Skip the 'I hope this finds you well' opener. Casual but professional. (Constraints)"

  - type: mcq
    xp: 15
    question: "Which prompt follows RTCC?"
    options:
      - id: a
        text: "Write a witty Instagram caption for a café."
        is_correct: false
        rationale: "No role, no context, no constraints. Generic output guaranteed."
      - id: b
        text: "Act as a Mumbai food blogger (Role). Write a 1-line Instagram caption (Task) for my photo of a sourdough at Bombay Bread, a new Bandra café (Context). Self-deprecating, no emojis, under 12 words (Constraints)."
        is_correct: true
        rationale: "All four pieces present. Output will be specific, on-brand, usable."
      - id: c
        text: "Help me with my café Instagram."
        is_correct: false
        rationale: "Closer to a search query than a brief."

  - type: drag_to_reorder
    xp: 10
    prompt: "Put the RTCC pieces in order."
    items:
      - { id: r, label: "Role — who the AI should be" }
      - { id: t, label: "Task — what you want" }
      - { id: c1, label: "Context — what it needs to know" }
      - { id: c2, label: "Constraints — length, tone, format" }
    correct_order: [r, t, c1, c2]

  - type: free_text
    xp: 15
    prompt: "Write an RTCC prompt for a real task you have this week. All 4 pieces."
    placeholder: "Act as…"
    min_chars: 80

  - type: exercise
    xp: 25
    tool: chatgpt
    instruction: |
      Open ChatGPT. Paste your RTCC prompt from the previous step. Send it.
      Then send the same task as a one-liner — no role, no context, no constraints.
      Compare the two replies.

  - type: checkpoint
    title: "RTCC is now in your toolkit."
    summary: |
      You've seen the 5× quality jump from a 4-piece checklist. Tomorrow's
      lesson: turning RTCC into muscle memory across email, code, and
      research workflows — without sounding like a robot.
```

---

## 6. Final checklist before you output

Before returning a YAML, verify ALL of these:

- [ ] Top-level keys: `title`, `estimated_minutes`, `xp_reward`, `turns`. (`subtitle` optional.)
- [ ] `turns` is a non-empty array.
- [ ] **Last turn is `type: checkpoint`.**
- [ ] Each `id:` is lowercase, alphanumeric, hyphens only.
- [ ] Each `mcq` has exactly one `is_correct: true` (unless `allow_multiple: true`).
- [ ] Each `mcq` option has a `rationale` (best practice).
- [ ] `tap_to_match` is bijective: `left.length === right.length === pairs.length`, every id used once.
- [ ] `drag_to_reorder.correct_order` lists every item id exactly once.
- [ ] `fill_in_the_blank.template` has `___` for each blank, in the same order as `answers[]`.
- [ ] All long text uses YAML `|` block scalar (no inline strings with `:` or `*` or quotes).
- [ ] Total turn count: 8–25.
- [ ] Sum of turn `xp` values is roughly half the lesson `xp_reward`.
- [ ] No emojis in tutor text (unless explicitly requested).
- [ ] Tone matches Nova: warm, direct, concrete examples, short paragraphs.
- [ ] No prompts of the form "I'm an AI…" or "As an AI language model…".

Output **only the YAML**, nothing else — no preamble, no markdown fences, no commentary. Just the YAML, ready to paste.
