import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPageRenderer } from "@/components/public/public-page-renderer";
import { getDescendantIds } from "@/lib/page-tree";
import { getServerSupabase } from "@/lib/supabase/server";
import type { DatabaseProperty, WorkspacePage } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPublicPage(slug);
  if (!result) return { title: "Página no encontrada" };
  const description = result.page.plain_text.slice(0, 160) || `Página pública: ${result.page.title}`;
  return {
    description,
    openGraph: {
      description,
      images: result.coverUrl ? [result.coverUrl] : [],
      title: result.page.title,
      type: "article",
    },
    title: result.page.title,
    twitter: {
      card: result.coverUrl ? "summary_large_image" : "summary",
      description,
      images: result.coverUrl ? [result.coverUrl] : [],
      title: result.page.title,
    },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await loadPublicPage(slug);
  if (!result) notFound();
  return (
    <PublicPageRenderer
      coverUrl={result.coverUrl}
      page={result.page}
      pages={result.pages}
      properties={result.properties}
    />
  );
}

async function loadPublicPage(slug: string) {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: share } = await supabase
    .from("page_shares")
    .select("page_id")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!share) return null;
  const { data: page } = await supabase
    .from("pages")
    .select("*")
    .eq("id", share.page_id)
    .eq("is_archived", false)
    .maybeSingle();
  if (!page) return null;
  const typedPage = page as WorkspacePage;
  const { data: pages } = await supabase
    .from("pages")
    .select("*")
    .eq("workspace_id", typedPage.workspace_id)
    .eq("is_archived", false)
    .order("position", { ascending: true });
  const visiblePages = (pages ?? []) as WorkspacePage[];
  const subtreeIds = new Set(getDescendantIds(visiblePages, typedPage.id));
  const typedPages = visiblePages.filter((item) => subtreeIds.has(item.id));
  const databaseIds = typedPages.filter((item) => item.type === "database").map((item) => item.id);
  const { data: properties } = databaseIds.length
    ? await supabase.from("db_properties").select("*").in("page_id", databaseIds).order("position")
    : { data: [] };
  let coverUrl: string | null = null;
  if (typedPage.cover_url) {
    if (/^https?:/i.test(typedPage.cover_url)) coverUrl = typedPage.cover_url;
    else {
      const { data } = await supabase.storage
        .from("workspace-files")
        .createSignedUrl(typedPage.cover_url, 60 * 60);
      coverUrl = data?.signedUrl ?? null;
    }
  }
  return {
    coverUrl,
    page: typedPage,
    pages: typedPages,
    properties: (properties ?? []) as DatabaseProperty[],
  };
}
