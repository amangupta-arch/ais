// Catch-all dynamic route for the wiki. Maps URL segments to MDX
// files on disk via lib/wiki/content.ts, renders the body with
// next-mdx-remote/rsc, and surfaces frontmatter (title, summary,
// related, last_reviewed) as the page header + footer.
//
// 404 for any slug that doesn't have a matching .mdx file — keeps
// the wiki tightly tied to what actually exists in the repo.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";
import { ArrowLeft } from "lucide-react";

import { getWikiPage } from "@/lib/wiki/content";
import { autolinkBody } from "@/lib/wiki/autolink";

export const dynamic = "force-dynamic";

type Params = { slug?: string[] };

function slugFromParams(params: Params): string {
  return (params.slug ?? []).join("/");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const slug = slugFromParams(await params);
  const page = await getWikiPage(slug);
  if (!page) return { title: "Not found · Wiki" };
  return {
    title: `${page.meta.title} · Wiki`,
    description: page.meta.summary,
  };
}

export default async function WikiPageView({
  params,
}: {
  params: Promise<Params>;
}) {
  const slug = slugFromParams(await params);
  const page = await getWikiPage(slug);
  if (!page) notFound();

  const isRoot = page.slug === "";
  const sectionRoot = page.slug.split("/")[0] ?? "";
  const isSectionRoot = page.slug !== "" && page.slug === sectionRoot;
  const sectionLabel =
    !isRoot && !isSectionRoot ? sectionRoot.replace(/-/g, " ") : null;

  return (
    <>
      <header className="wiki-header">
        {sectionLabel && (
          <Link href={`/wiki/${sectionRoot}`} className="wiki-header__back">
            <ArrowLeft size={14} aria-hidden /> {sectionLabel}
          </Link>
        )}
        <h1 className="wiki-header__title">{page.meta.title}</h1>
        {page.meta.summary && (
          <p className="wiki-header__summary">{page.meta.summary}</p>
        )}
      </header>

      <div className="wiki-body">
        {/* autolinkBody patches in cross-references for proper-noun
            mentions (Maya, ElevenLabs, Supabase, Sentry, Cashfree…)
            so the wiki stays navigable without manually adding a
            link for every reference. Lives in lib/wiki/autolink.ts. */}
        <MDXRemote source={autolinkBody(page.body, page.slug)} />
      </div>

      {(page.meta.related?.length || page.meta.last_reviewed) && (
        <footer className="wiki-footer">
          {page.meta.related?.length ? (
            <div>
              <div className="wiki-footer__label">Related</div>
              <ul className="wiki-footer__related">
                {page.meta.related.map((href) => (
                  <li key={href}>
                    <Link href={href}>{href.replace(/^\/wiki\//, "")}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {page.meta.last_reviewed && (
            <div className="wiki-footer__reviewed">
              Last reviewed · {page.meta.last_reviewed}
            </div>
          )}
        </footer>
      )}
    </>
  );
}
