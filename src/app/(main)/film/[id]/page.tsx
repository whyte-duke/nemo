import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMovieDetail, tmdbImage } from "@/lib/tmdb/client";
import { MovieDetailContent } from "@/components/media/MovieDetailContent";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const movie = await getMovieDetail(Number(id));
    return {
      title: movie.title,
      description: movie.overview?.slice(0, 160) ?? undefined,
      openGraph: {
        title: movie.title,
        description: movie.overview?.slice(0, 160) ?? undefined,
        images: movie.backdrop_path
          ? [tmdbImage.backdrop(movie.backdrop_path, "w1280") ?? ""]
          : [],
      },
    };
  } catch {
    return { title: "Film introuvable" };
  }
}

export default async function FilmPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);

  if (!numId || isNaN(numId)) notFound();

  try {
    const movie = await getMovieDetail(numId);
    return <MovieDetailContent movie={movie} />;
  } catch {
    notFound();
  }
}
