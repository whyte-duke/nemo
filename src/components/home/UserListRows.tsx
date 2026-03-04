"use client";

import { useQuery } from "@tanstack/react-query";
import { MediaRow } from "@/components/media/MediaRow";
import type { ListPreview } from "@/app/api/lists/preview/route";

interface UserListRowsProps {
  onPlay?: (item: { id: number; title?: string; name?: string }, type: "movie" | "tv") => void;
  onMoreInfo?: (item: { id: number; title?: string; name?: string }, type: "movie" | "tv") => void;
  hideIfSeen?: boolean;
}

export function UserListRows({ onPlay, onMoreInfo, hideIfSeen = false }: UserListRowsProps) {
  const { data, isLoading } = useQuery<{ lists: ListPreview[] }>({
    queryKey: ["lists-preview"],
    queryFn: async () => {
      const res = await fetch("/api/lists/preview");
      if (!res.ok) throw new Error("Erreur chargement");
      return res.json() as Promise<{ lists: ListPreview[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!isLoading && !data?.lists?.length) return null;

  const lists = data?.lists ?? [];

  return (
    <>
      {lists.map((list) => {
        // Convertit les items de liste en format compatible MediaRow/MediaCard
        const items = list.items.map((item) => ({
          id: item.tmdb_id,
          title: item.media_type === "movie" ? item.title : undefined,
          name: item.media_type === "tv" ? item.title : undefined,
          poster_path: item.poster_path,
          backdrop_path: item.backdrop_path,
          vote_average: item.vote_average,
          vote_count: 0,
          popularity: 0,
          genre_ids: item.genre_ids,
          overview: "",
          media_type: item.media_type,
        }));

        // Détermine le type dominant de la liste
        const movieCount = list.items.filter((i) => i.media_type === "movie").length;
        const dominantType: "movie" | "tv" = movieCount >= list.items.length / 2 ? "movie" : "tv";

        const listTitle = list.icon ? `${list.name} ${list.icon}` : list.name;

        return (
          <MediaRow
            key={list.id}
            title={listTitle}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items={items as any}
            mediaType={dominantType}
            viewAllHref={`/ma-liste`}
            onPlay={
              onPlay
                ? (item) => {
                    const listItem = list.items.find((i) => i.tmdb_id === item.id);
                    const type = listItem?.media_type ?? dominantType;
                    onPlay({ id: item.id, title: (item as { title?: string }).title, name: (item as { name?: string }).name }, type);
                  }
                : undefined
            }
            onMoreInfo={
              onMoreInfo
                ? (item) => {
                    const listItem = list.items.find((i) => i.tmdb_id === item.id);
                    const type = listItem?.media_type ?? dominantType;
                    onMoreInfo({ id: item.id, title: (item as { title?: string }).title, name: (item as { name?: string }).name }, type);
                  }
                : undefined
            }
            hideIfSeen={hideIfSeen}
            isLoading={isLoading && !data}
          />
        );
      })}
    </>
  );
}
