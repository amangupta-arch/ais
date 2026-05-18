"use client";

// Render lesson text with a small, safe subset of markdown + custom
// colour / highlight directives.
//
// Supported syntax (all of it allow-listed; anything else is dropped):
//   **bold**, *italic*, ~~strike~~, lists (- / 1.), paragraph breaks
//   :hl[word]               — yellow highlight (default)
//   :hl-yellow[…] :hl-green[…] :hl-red[…] :hl-blue[…]
//   :red[…] :green[…] :blue[…] :yellow[…] :purple[…] :indigo[…] :gray[…]
//
// Directive names → CSS classes are pinned to the allow-list below.
// Any other directive name renders its children as plain text. Raw
// HTML in source is dropped (`skipHtml`), and the allow-list of
// rendered tags is locked down — there is no `<a>`, `<img>`, `<script>`,
// `<iframe>` path through this component, even for trusted authors.
//
// Two modes:
//   - inline (default): collapses paragraphs to <span> so the text can
//     sit inside an existing <h2> / <p> in the lesson player.
//   - block (`block` prop): emits real <p>/<ul>/<li>. Use for multi-
//     paragraph copy like the checkpoint summary.

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";

const DIRECTIVE_CLASS: Record<string, string> = {
  red:    "lp-color-red",
  green:  "lp-color-green",
  blue:   "lp-color-blue",
  yellow: "lp-color-yellow",
  purple: "lp-color-purple",
  indigo: "lp-color-indigo",
  gray:   "lp-color-gray",
  hl:          "lp-hl-yellow",
  "hl-yellow": "lp-hl-yellow",
  "hl-green":  "lp-hl-green",
  "hl-red":    "lp-hl-red",
  "hl-blue":   "lp-hl-blue",
};

// `react-markdown` allow-list — every other tag is dropped.
const ALLOWED_ELEMENTS = [
  "p", "br", "span",
  "strong", "em", "del",
  "ul", "ol", "li",
];

// Walk every directive node and convert it to a span with an allow-listed
// class. Unknown directive names fall through as bare spans (children
// render as plain text, so the directive vanishes silently).
function remarkLessonDirectives() {
  return (tree: unknown) => {
    walk(tree, (node) => {
      if (
        node.type === "textDirective" ||
        node.type === "leafDirective" ||
        node.type === "containerDirective"
      ) {
        const className = node.name ? DIRECTIVE_CLASS[node.name] : undefined;
        node.data = node.data || {};
        node.data.hName = "span";
        node.data.hProperties = className ? { className: [className] } : {};
      }
    });
  };
}

type MdNode = { type: string; name?: string; data?: Record<string, unknown>; children?: MdNode[] };
function walk(node: unknown, visit: (n: MdNode) => void) {
  if (!node || typeof node !== "object") return;
  const n = node as MdNode;
  visit(n);
  if (Array.isArray(n.children)) for (const child of n.children) walk(child, visit);
}

// Inline mode: <p> would be invalid HTML inside an <h2> / <p> ancestor,
// so collapse it to a <span>. Lists render as-is — rare inside inline
// context but still allowed.
const INLINE_COMPONENTS: Components = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  p: ({ node: _node, children, ...rest }) => <span {...rest}>{children}</span>,
};

export function RichText({
  children,
  block = false,
}: {
  children: string;
  block?: boolean;
}) {
  const remarkPlugins = useMemo(
    () => [remarkGfm, remarkDirective, remarkLessonDirectives],
    [],
  );
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      allowedElements={ALLOWED_ELEMENTS}
      unwrapDisallowed
      skipHtml
      components={block ? undefined : INLINE_COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}
