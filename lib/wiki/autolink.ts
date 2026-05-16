// Auto-link first occurrence of named concepts on every wiki page.
//
// Rule of thumb: a proper noun or app-specific term mentioned in
// prose should be a link the first time it shows up. Manual
// markdown links (added inside MDX bodies) are preserved as-is —
// this just patches over the un-linked plain-text mentions.
//
// Scope intentionally small. Only obvious proper nouns / named
// concepts go in `RULES`. Adding too many turns the wiki into a
// sea of blue.
//
// Constraints:
//   - First non-code, non-already-linked occurrence per page only.
//   - Self-references (slug === current page) are skipped.
//   - Inside ``` ``` fenced blocks → never linked.
//   - Inside `inline code` on the same line → not linked here, but
//     keeps looking on later lines for a prose mention to link.

type AutoLinkRule = {
  /** Literal phrase to match (case-sensitive). */
  term: string;
  /** Wiki slug (without leading /wiki/). */
  slug: string;
};

const RULES: AutoLinkRule[] = [
  // Brand + product
  { term: "AI Setu", slug: "glossary/ais" },
  { term: "Maya", slug: "glossary/maya" },
  { term: "Lumen", slug: "glossary/lumen" },

  // External systems
  { term: "ElevenLabs", slug: "architecture/audio-pipeline" },
  { term: "Supabase", slug: "architecture/tech-stack" },
  { term: "Vercel", slug: "architecture/tech-stack" },
  { term: "Sentry", slug: "architecture/instrumentation" },
  { term: "Cashfree", slug: "operations/cashfree-integration" },
  { term: "Anthropic", slug: "architecture/tech-stack" },
  { term: "Claude Sonnet", slug: "architecture/tech-stack" },

  // Personas
  { term: "Nova", slug: "glossary/persona" },
  { term: "Arjun", slug: "glossary/persona" },
  { term: "Riya", slug: "glossary/persona" },
  { term: "Sensei", slug: "glossary/persona" },

  // Internal concepts
  { term: "tierCanAccess", slug: "architecture/plan-model" },
  { term: "getMe()", slug: "architecture/auth" },
  { term: "yaml-generate", slug: "authoring/yaml-generate-flow" },
];

const ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s: string): string {
  return s.replace(ESCAPE_REGEX, "\\$&");
}

/** Walk the MDX body line by line, toggle fenced-code state, and
 *  replace the FIRST non-code non-already-linked occurrence of each
 *  term with a markdown link. */
export function autolinkBody(body: string, currentSlug: string): string {
  const lines = body.split("\n");
  let inFence = false;
  const used = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Toggle fence markers ( ``` / ```ts / etc.). Use trimStart so
    // indented blocks (rare in our content) still work.
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    let working = line;
    for (const rule of RULES) {
      if (used.has(rule.term)) continue;
      if (rule.slug === currentSlug) continue;

      // Skip if this line has an existing markdown link containing the
      // term — don't double-link the same word. Mark the term consumed
      // so later lines don't re-add a competing link.
      const inExistingLink = new RegExp(
        `\\[[^\\]]*${escapeRegex(rule.term)}[^\\]]*\\]\\([^)]+\\)`,
      );
      if (inExistingLink.test(working)) {
        used.add(rule.term);
        continue;
      }

      // Skip if the term lives inside backticks on this line. Don't
      // mark used — we want to link a later prose mention if one
      // exists.
      const inInlineCode = new RegExp(
        "`[^`\\n]*" + escapeRegex(rule.term) + "[^`\\n]*`",
      );
      if (inInlineCode.test(working)) continue;

      // Word-boundary match; only the first occurrence on this line.
      // We can't use \b at the term's ends because some terms end
      // in non-word characters (e.g. "getMe()"). \b in JS regex only
      // matches the boundary between word and non-word, so \b)
      // never fires. Negative lookbehind / lookahead on the word-
      // char set handles both flavours: for "Maya" it's equivalent
      // to \b; for "getMe()" it just asserts the next char isn't a
      // word character (or is end of line).
      const wordChar = "[A-Za-z0-9_]";
      const matcher = new RegExp(
        `(?<!${wordChar})${escapeRegex(rule.term)}(?!${wordChar})`,
      );
      const match = matcher.exec(working);
      if (!match) continue;

      const before = working.slice(0, match.index);
      const after = working.slice(match.index + rule.term.length);
      working = `${before}[${rule.term}](/wiki/${rule.slug})${after}`;
      used.add(rule.term);
    }

    if (working !== line) lines[i] = working;
  }

  return lines.join("\n");
}
