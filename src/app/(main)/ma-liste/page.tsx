"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BookMarked, Play, Trash2, Plus, MoreHorizontal, Pencil, Users, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyLists, useToggleItemInList, useDeleteList, useUpdateList } from "@/hooks/use-lists";
import { useStream } from "@/providers/stream-provider";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { StreamModal } from "@/components/player/StreamModal";
import { CreateListModal } from "@/components/lists/CreateListModal";
import { tmdbImage } from "@/lib/tmdb/client";
import type { ListSummary } from "@/hooks/use-lists";

function MemberAvatars({ members }: { members: ListSummary["members"] }) {
  const visible = members.slice(0, 4);
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((m, i) => (
        <div
          key={m.user_id}
          className="relative size-5 rounded-full ring-1 ring-black overflow-hidden bg-white/10 shrink-0"
          style={{ zIndex: visible.length - i }}
        >
          {m.avatar_url ? (
            <Image src={m.avatar_url} alt="" fill className="object-cover" sizes="20px" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/60">
              {(m.display_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
      {members.length > 4 && (
        <div className="relative size-5 rounded-full ring-1 ring-black bg-white/15 flex items-center justify-center text-[7px] font-bold text-white/60">
          +{members.length - 4}
        </div>
      )}
    </div>
  );
}

function ListContextMenu({
  list,
  onRename,
}: {
  list: ListSummary;
  onRename: () => void;
}) {
  const { mutate: deleteList } = useDeleteList();
  const { mutate: updateList } = useUpdateList();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center size-6 rounded-full hover:bg-white/15 transition-colors text-white/50 hover:text-white"
          aria-label="Options de la liste"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-(--z-modal) min-w-45 glass-tile overflow-hidden shadow-2xl py-1"
          style={{ borderRadius: "14px" }}
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu.Item
            onSelect={onRename}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/8 cursor-pointer outline-none data-highlighted:bg-white/8"
          >
            <Pencil className="size-3.5" />
            Renommer
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={() => updateList({ id: list.id, is_public: !list.is_public })}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-white/75 hover:text-white hover:bg-white/8 cursor-pointer outline-none data-highlighted:bg-white/8"
          >
            <Globe className="size-3.5" />
            {list.is_public ? "Rendre privée" : "Rendre publique"}
          </DropdownMenu.Item>

          {!list.is_default && (
            <>
              <DropdownMenu.Separator className="h-px bg-white/8 my-1" />
              <DropdownMenu.Item
                onSelect={() => {
                  if (confirm(`Supprimer la liste "${list.name}" ?`)) {
                    deleteList(list.id);
                  }
                }}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 cursor-pointer outline-none data-highlighted:bg-red-500/10"
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function MesListesPage() {
  const { data: lists = [], isLoading } = useMyLists();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const { mutate: removeItem } = useToggleItemInList();
  const { resolveStreams } = useStream();
  const [watchMovieId, setWatchMovieId] = useState<number | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [activeTitle, setActiveTitle] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [renamingListId, setRenamingListId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { mutate: updateList } = useUpdateList();

  void resolveStreams;

  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;

  const handlePlay = useCallback(
    (tmdbId: number, mediaType: "movie" | "tv", title: string) => {
      if (mediaType === "movie") {
        setWatchMovieId(tmdbId);
        return;
      }
      setActiveTitle(title);
      setStreamOpen(true);
    },
    []
  );

  return (
    <div className="bg-[#0b0d12] min-h-dvh">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BookMarked className="size-6 text-nemo-accent" />
            <h1 className="text-2xl font-black text-white">Mes Listes</h1>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold text-sm rounded-full transition-colors shadow-lg shadow-amber-500/15"
          >
            <Plus className="size-4" />
            Nouvelle liste
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="size-8 text-white/30 animate-spin" />
          </div>
        )}

        {!isLoading && lists.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <BookMarked className="size-16 text-white/10 mx-auto" />
            <p className="text-white/60 text-lg font-medium">Aucune liste</p>
            <p className="text-white/30 text-sm">Créez votre première liste ou ajoutez des films depuis le catalogue</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 mt-4 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              <Plus className="size-4" />
              Créer une liste
            </button>
          </div>
        )}

        {!isLoading && lists.length > 0 && (
          <>
            {/* Onglets */}
            <div className="flex items-end gap-1 mb-8 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
              {lists.map((list) => {
                const isActive = list.id === (activeList?.id ?? lists[0]?.id);
                const isCollaborative = list.members.length > 1;

                return (
                  <div
                    key={list.id}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 shrink-0 group",
                      isActive
                        ? "bg-white/12 text-white"
                        : "text-white/45 hover:text-white/70 hover:bg-white/6"
                    )}
                    onClick={() => setActiveListId(list.id)}
                  >
                    <span className="text-base leading-none">{list.icon ?? "🎬"}</span>
                    <span className={cn("text-sm font-medium truncate max-w-30", isActive && "font-semibold")}>
                      {list.name}
                    </span>

                    {list.item_count > 0 && (
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded-full tabular-nums",
                        isActive ? "bg-white/15 text-white/70" : "bg-white/8 text-white/35"
                      )}>
                        {list.item_count}
                      </span>
                    )}

                    {isCollaborative && (
                      <div className="flex items-center gap-1">
                        <MemberAvatars members={list.members} />
                      </div>
                    )}

                    {list.role === "owner" && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ListContextMenu
                          list={list}
                          onRename={() => {
                            setRenamingListId(list.id);
                            setRenameValue(list.name);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Formulaire de renommage inline */}
            {renamingListId && (
              <div className="mb-6 flex items-center gap-3 bg-white/6 border border-white/10 rounded-xl px-4 py-3">
                <Pencil className="size-4 text-white/40 shrink-0" />
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value.slice(0, 30))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && renameValue.trim()) {
                      updateList({ id: renamingListId, name: renameValue.trim() });
                      setRenamingListId(null);
                    }
                    if (e.key === "Escape") setRenamingListId(null);
                  }}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
                  placeholder="Nouveau nom…"
                  maxLength={30}
                  autoFocus
                />
                <span className="text-xs text-white/25">{renameValue.length}/30</span>
                <button
                  onClick={() => {
                    if (renameValue.trim()) {
                      updateList({ id: renamingListId, name: renameValue.trim() });
                    }
                    setRenamingListId(null);
                  }}
                  className="text-xs text-nemo-accent hover:text-[#f0c85a] font-semibold transition-colors"
                >
                  Sauvegarder
                </button>
                <button
                  onClick={() => setRenamingListId(null)}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  Annuler
                </button>
              </div>
            )}

            {/* Info liste collaborative */}
            {activeList && activeList.members.length > 1 && (
              <div className="flex items-center gap-2 mb-6 text-sm text-white/40">
                <Users className="size-4" />
                <span>Liste partagée avec </span>
                <span className="text-white/60">
                  {activeList.members
                    .filter((m) => m.role !== "owner" || m.user_id !== activeList.members.find((mm) => mm.role === "owner")?.user_id)
                    .slice(0, 3)
                    .map((m) => m.display_name ?? "Ami")
                    .join(", ")}
                </span>
              </div>
            )}

            {/* Grille items — affiche les données de la liste active depuis /api/lists/[id] */}
            {activeList && <ListItemsGrid list={activeList} onPlay={handlePlay} onRemove={(tmdbId, mediaType) => removeItem({ listId: activeList.id, tmdbId, mediaType, action: "remove" })} />}
          </>
        )}
      </div>

      <CreateListModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setActiveListId(id)}
      />

      <MovieWatchModal
        open={watchMovieId !== null}
        onClose={() => setWatchMovieId(null)}
        movieId={watchMovieId ?? 0}
      />

      <StreamModal
        open={streamOpen}
        onClose={() => setStreamOpen(false)}
        title={activeTitle}
      />
    </div>
  );
}

function ListItemsGrid({
  list,
  onPlay,
  onRemove,
}: {
  list: ListSummary;
  onPlay: (tmdbId: number, mediaType: "movie" | "tv", title: string) => void;
  onRemove: (tmdbId: number, mediaType: "movie" | "tv") => void;
}) {
  const [items, setItems] = useState<Array<{ id: string; tmdb_id: number; media_type: "movie" | "tv"; title: string; poster_path: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  // Charge les items de la liste depuis l'API
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    fetch(`/api/lists/${list.id}`)
      .then((r) => r.json())
      .then((data: { items?: Array<{ id: string; tmdb_id: number; media_type: "movie" | "tv"; title: string; poster_path: string | null }> }) => {
        if (!cancelled) {
          setItems(data.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [list.id]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-2/3 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <span className="text-5xl">{list.icon ?? "🎬"}</span>
        <p className="text-white/50 font-medium">Cette liste est vide</p>
        <p className="text-white/25 text-sm">Ajoutez des films et séries depuis le catalogue</p>
        <Link
          href="/"
          className="inline-block mt-3 text-nemo-accent hover:text-[#f0c85a] text-sm font-semibold transition-colors"
        >
          Explorer le catalogue →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <div key={item.id} className="group relative">
          <Link
            href={item.media_type === "movie" ? `/film/${item.tmdb_id}` : `/serie/${item.tmdb_id}`}
            className="block"
          >
            <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-[#1a1e28] mb-2">
              {item.poster_path ? (
                <Image
                  src={tmdbImage.poster(item.poster_path, "w342") ?? ""}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 skeleton" />
              )}

              <div className="absolute inset-0 flex items-end p-3 card-overlay opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onPlay(item.tmdb_id, item.media_type, item.title);
                  }}
                  aria-label="Lire"
                  className="flex items-center justify-center size-10 rounded-full bg-white hover:bg-white/90 transition-colors"
                >
                  <Play className="size-5 text-black fill-black ml-0.5" />
                </button>
              </div>
            </div>
          </Link>

          <button
            onClick={() => onRemove(item.tmdb_id, item.media_type)}
            aria-label="Retirer de la liste"
            className="absolute top-2 right-2 flex items-center justify-center size-8 rounded-full glass opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 text-white/60 transition-all"
          >
            <Trash2 className="size-4" />
          </button>

          <p className="text-white/70 text-xs truncate px-0.5" title={item.title}>
            {item.title}
          </p>
        </div>
      ))}
    </div>
  );
}
