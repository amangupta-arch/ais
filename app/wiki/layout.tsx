// /wiki layout — admin allow-list gate + sidebar + content rail.
//
// Server component. Reads the signed-in user, checks against
// WIKI_ADMINS, and renders the sidebar tree (built from MDX files
// in content/wiki/) alongside the page body.
//
// Anonymous → redirect to /login?next=<the page they wanted>
// Signed in but not an admin → redirect to /home (silent, doesn't
//   leak that /wiki exists)

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isWikiAdmin } from "@/lib/wiki/access";
import { getSearchIndex, getWikiTree } from "@/lib/wiki/content";

import Sidebar from "./Sidebar";
import "./wiki.css";

export const dynamic = "force-dynamic";

export default async function WikiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/wiki");
  if (!isWikiAdmin(user.email)) redirect("/home");

  const [tree, searchIndex] = await Promise.all([
    getWikiTree(),
    getSearchIndex(),
  ]);

  return (
    <div className="wiki-shell">
      <Sidebar tree={tree} searchIndex={searchIndex} />
      <main className="wiki-content">
        <article className="wiki-article">{children}</article>
      </main>
    </div>
  );
}
