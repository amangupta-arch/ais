// File-system-backed loader for the /wiki MDX content.
//
// The wiki is intentionally NOT in the database — every edit is a
// git commit, so future Claude sessions can update the brain in
// the same PR as the feature they describe. File path on disk maps
// 1:1 to the URL:
//
//   content/wiki/architecture/plans.mdx
//        ↓
//   /wiki/architecture/plans
//
// Frontmatter contract (every page must have):
//
//   ---
//   title: "Multi-plan access model"
//   summary: "Why student is a parallel track to the AI-tool ladder"
//   section: architecture
//   order: 30
//   keywords: [plans, tier, tierCanAccess, subscriptions]
//   related: [/wiki/architecture/db-schema]
//   last_reviewed: 2026-05-13
//   ---
//
// A page named `_index.mdx` is treated as the section landing —
// its slug drops the `_index` and resolves to the section root.

import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

export type WikiFrontmatter = {
  title: string;
  summary?: string;
  section?: string;
  order?: number;
  keywords?: string[];
  related?: string[];
  last_reviewed?: string;
};

export type WikiPage = {
  /** URL slug, e.g. "architecture/plans". The wiki root is "". */
  slug: string;
  /** Frontmatter, with title guaranteed to be present. */
  meta: WikiFrontmatter;
  /** MDX source body (after stripping frontmatter). */
  body: string;
};

export type WikiNode = {
  slug: string;
  title: string;
  summary?: string;
  order: number;
  children: WikiNode[];
};

const CONTENT_ROOT = path.join(process.cwd(), "content", "wiki");

/** Read and parse one MDX file by its on-disk path. */
async function readMdxFile(absPath: string): Promise<{ data: WikiFrontmatter; content: string }> {
  const raw = await fs.readFile(absPath, "utf-8");
  const parsed = matter(raw);
  return {
    data: parsed.data as WikiFrontmatter,
    content: parsed.content,
  };
}

/** Convert an on-disk path to its public wiki slug. */
function slugForFile(absPath: string): string {
  const rel = path.relative(CONTENT_ROOT, absPath);
  // strip .mdx
  let slug = rel.replace(/\.mdx$/i, "");
  // A file named "_index" inside a section folder resolves to the
  // section root: architecture/_index → architecture
  slug = slug.replace(/(^|\/)_index$/, "$1").replace(/\/$/, "");
  // Normalise separators on Windows just in case.
  slug = slug.split(path.sep).join("/");
  return slug;
}

/** Walk content/wiki recursively and yield every .mdx file path. */
async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mdx")) {
      yield full;
    }
  }
}

let _cachedPages: WikiPage[] | null = null;

/** Returns every page in the wiki, sorted by section + order + title.
 *  Cached for the process lifetime — Vercel cold-starts already give
 *  us a fresh read, and force-dynamic on the route handler means we
 *  re-read on every deploy. */
export async function getAllWikiPages(): Promise<WikiPage[]> {
  if (_cachedPages) return _cachedPages;

  const pages: WikiPage[] = [];
  for await (const absPath of walk(CONTENT_ROOT)) {
    const { data, content } = await readMdxFile(absPath);
    if (!data?.title) {
      // Skip files missing title — they're either WIP drafts or
      // an authoring mistake we'd rather surface than crash on.
      continue;
    }
    pages.push({
      slug: slugForFile(absPath),
      meta: data,
      body: content,
    });
  }
  pages.sort((a, b) => {
    // Root first, then by section, then by order, then by title.
    if (a.slug === "" && b.slug !== "") return -1;
    if (b.slug === "" && a.slug !== "") return 1;
    const aSec = a.meta.section ?? a.slug.split("/")[0] ?? "";
    const bSec = b.meta.section ?? b.slug.split("/")[0] ?? "";
    if (aSec !== bSec) return aSec.localeCompare(bSec);
    const aOrd = a.meta.order ?? 999;
    const bOrd = b.meta.order ?? 999;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return a.meta.title.localeCompare(b.meta.title);
  });
  _cachedPages = pages;
  return pages;
}

/** Look up one page by its slug, or null if it doesn't exist. */
export async function getWikiPage(slug: string): Promise<WikiPage | null> {
  const all = await getAllWikiPages();
  return all.find((p) => p.slug === slug) ?? null;
}

/** Build a hierarchical tree of (section → page) for the sidebar.
 *  Top-level entries are sections, each section's children are its
 *  pages (sorted by order). Section landing pages (slug equals the
 *  section name, e.g. "architecture") are the section nodes
 *  themselves; their child pages come from siblings sharing the
 *  prefix. */
export async function getWikiTree(): Promise<WikiNode[]> {
  const all = await getAllWikiPages();

  // Group by top-level segment of the slug. The root page (slug="")
  // is excluded from the tree — the sidebar always links to it as
  // the wiki home and doesn't need to render it again.
  const sections = new Map<string, WikiNode>();
  for (const page of all) {
    if (page.slug === "") continue;
    const segments = page.slug.split("/");
    const top = segments[0]!;
    const isSectionRoot = segments.length === 1;

    if (!sections.has(top)) {
      sections.set(top, {
        slug: top,
        title: top, // placeholder; overwritten by the section's _index frontmatter below
        order: 999,
        children: [],
      });
    }
    const node = sections.get(top)!;
    if (isSectionRoot) {
      node.title = page.meta.title;
      node.summary = page.meta.summary;
      node.order = page.meta.order ?? 999;
    } else {
      node.children.push({
        slug: page.slug,
        title: page.meta.title,
        summary: page.meta.summary,
        order: page.meta.order ?? 999,
        children: [],
      });
    }
  }

  // Sort children within each section, then sort sections.
  const tree = Array.from(sections.values());
  for (const node of tree) {
    node.children.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }
  tree.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return tree;
}

/** Lightweight search index built from titles + summaries +
 *  keywords. Tiny enough to ship to the client whole; saves us a
 *  whole search backend. */
export type SearchEntry = {
  slug: string;
  title: string;
  summary: string;
  haystack: string;
};

export async function getSearchIndex(): Promise<SearchEntry[]> {
  const all = await getAllWikiPages();
  return all.map((p) => ({
    slug: p.slug,
    title: p.meta.title,
    summary: p.meta.summary ?? "",
    haystack: [
      p.meta.title,
      p.meta.summary ?? "",
      (p.meta.keywords ?? []).join(" "),
      // First ~400 chars of the body — enough for prefix matches on
      // unique terms without bloating the index.
      p.body.slice(0, 400),
    ]
      .join(" ")
      .toLowerCase(),
  }));
}
