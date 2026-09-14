import MapClient from "./MapClient";
import type { MapEntry } from "@encarta/core";
import { BASE } from "@/lib/constants";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

async function fetchMapEntry(slug: string): Promise<MapEntry | null> {
  try {
    const res = await fetch(`${BASE}/maps/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const map = await fetchMapEntry(slug);
  if (!map) {
    return { title: `${slug.replace(/-/g, " ")} · Truthseekers` };
  }
  const title = map.title || slug.replace(/-/g, " ");
  const description = map.subtitle || map.description?.slice(0, 200) || `An interactive map of ${title}.`;
  return {
    title: `${title} · Truthseekers`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `/maps/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function MapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const map = await fetchMapEntry(slug);

  if (!map) {
    return <MapClient slug={slug} map={null} />;
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(["map", slug], map);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MapClient slug={slug} map={map} />
    </HydrationBoundary>
  );
}
