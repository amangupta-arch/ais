"use client";

// Collapsible sidebar nav + client-side fuzzy search. Renders the
// section tree built server-side in lib/wiki/content.ts, plus a
// search input that filters titles + summaries + keywords + the
// first ~400 chars of every page body. The index is tiny (a few KB
// for ~50 pages), so we just ship it to the client whole.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";

import type { WikiNode } from "@/lib/wiki/content";

type SearchEntry = {
  slug: string;
  title: string;
  summary: string;
  haystack: string;
};

export default function Sidebar({
  tree,
  searchIndex,
}: {
  tree: WikiNode[];
  searchIndex: SearchEntry[];
}) {
  const pathname = usePathname() ?? "";
  const activeSlug = pathname.replace(/^\/wiki\/?/, "");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return searchIndex
      .map((e) => {
        const score = scoreEntry(e, q);
        return { entry: e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
  }, [query, searchIndex]);

  return (
    <aside className="wiki-sidebar">
      <Link href="/wiki" className="wiki-sidebar__brand">
        <span className="wiki-sidebar__brand-word">ai setu<em>.</em> wiki</span>
        <span className="wiki-sidebar__brand-sub">an internal brain</span>
      </Link>

      <div className="wiki-search">
        <Search size={14} className="wiki-search__icon" aria-hidden />
        <input
          type="search"
          className="wiki-search__input"
          placeholder="Search the brain…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search wiki"
        />
        {query && (
          <button
            type="button"
            className="wiki-search__clear"
            aria-label="Clear search"
            onClick={() => setQuery("")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {results ? (
        <SearchResults results={results} onPick={() => setQuery("")} />
      ) : (
        <TreeNav tree={tree} activeSlug={activeSlug} />
      )}
    </aside>
  );
}

function TreeNav({ tree, activeSlug }: { tree: WikiNode[]; activeSlug: string }) {
  return (
    <nav className="wiki-tree">
      {tree.map((section) => (
        <Section key={section.slug} node={section} activeSlug={activeSlug} />
      ))}
    </nav>
  );
}

function Section({ node, activeSlug }: { node: WikiNode; activeSlug: string }) {
  // A section is "open" if the current page is anywhere inside it,
  // or if it has no children (no reason to collapse a leaf).
  const isInside = activeSlug === node.slug || activeSlug.startsWith(`${node.slug}/`);
  const [open, setOpen] = useState(isInside || node.children.length === 0);

  return (
    <div className="wiki-tree__section">
      <div className="wiki-tree__section-row">
        <Link
          href={`/wiki/${node.slug}`}
          className={`wiki-tree__section-link ${activeSlug === node.slug ? "is-active" : ""}`}
        >
          {node.title}
        </Link>
        {node.children.length > 0 && (
          <button
            type="button"
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className={`wiki-tree__chevron ${open ? "is-open" : ""}`}
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
      {open && node.children.length > 0 && (
        <ul className="wiki-tree__children">
          {node.children.map((child) => (
            <li key={child.slug}>
              <Link
                href={`/wiki/${child.slug}`}
                className={`wiki-tree__leaf ${activeSlug === child.slug ? "is-active" : ""}`}
              >
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchResults({
  results,
  onPick,
}: {
  results: { entry: SearchEntry; score: number }[];
  onPick: () => void;
}) {
  if (results.length === 0) {
    return <p className="wiki-search__empty">Nothing matches that.</p>;
  }
  return (
    <ul className="wiki-search__results">
      {results.map(({ entry }) => (
        <li key={entry.slug}>
          <Link href={`/wiki/${entry.slug}`} onClick={onPick} className="wiki-search__hit">
            <span className="wiki-search__hit-title">{entry.title}</span>
            {entry.summary && (
              <span className="wiki-search__hit-summary">{entry.summary}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Score is title-prefix-weighted: a hit in the title counts more than
// a hit in the body. Two-character minimum (enforced upstream) keeps
// noise out.
function scoreEntry(e: SearchEntry, q: string): number {
  let s = 0;
  const title = e.title.toLowerCase();
  if (title.startsWith(q)) s += 40;
  else if (title.includes(q)) s += 20;
  if (e.haystack.includes(q)) s += 1;
  return s;
}
