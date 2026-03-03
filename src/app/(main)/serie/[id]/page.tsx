import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTVShowDetail, tmdbImage } from "@/lib/tmdb/client";
import { TVDetailContent } from "@/components/media/TVDetailContent";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const show = await getTVShowDetail(Number(id));
    return {
      title: show.name,
      description: show.overview?.slice(0, 160) ?? undefined,
      openGraph: {
        title: show.name,
        description: show.overview?.slice(0, 160) ?? undefined,
        images: show.backdrop_path
          ? [tmdbImage.backdrop(show.backdrop_path, "w1280") ?? ""]
          : [],
      },
    };
  } catch {
    return { title: "Série introuvable" };
  }
}

export default async function SeriePage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (!numId || isNaN(numId)) notFound();
  try {
    const show = await getTVShowDetail(numId);
    return <TVDetailContent show={show} />;
  } catch {
    notFound();
  }
}
