"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyLists, useToggleItemInList } from "@/hooks/use-lists";
import { useIsInMyList, useToggleMyList } from "@/hooks/use-list";
import { CreateListModal } from "./CreateListModal";

interface ListSelectorProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  size?: "sm" | "md";
  className?: string;
}

export function ListSelector({ tmdbId, mediaType, size = "sm", className }: ListSelectorProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: lists = [] } = useMyLists();
  const isInDefaultList = useIsInMyList(tmdbId, mediaType);
  const { mutate: toggleDefault } = useToggleMyList();
  const { mutate: toggleInList } = useToggleItemInList();

  const buttonSize = size === "sm" ? "size-8" : "size-10";
  const iconSize = size === "sm" ? "size-3" : "size-5";

  // 1 seule liste → comportement direct
  if (lists.length <= 1) {
    return (
      <>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleDefault({ tmdbId, mediaType, action: isInDefaultList ? "remove" : "add" });
          }}
          aria-label={isInDefaultList ? "Retirer de Ma Liste" : "Ajouter à Ma Liste"}
          className={cn(
            "flex items-center justify-center rounded-full transition-all shrink-0",
            "border border-white/30 hover:border-white/60",
            "bg-black/30 backdrop-blur-sm",
            isInDefaultList && "bg-white/15 border-white/50",
            buttonSize,
            className
          )}
        >
          {isInDefaultList ? (
            <Check className={cn(iconSize, "text-white")} />
          ) : (
            <Plus className={cn(iconSize, "text-white")} />
          )}
        </button>
        <CreateListModal open={createOpen} onClose={() => setCreateOpen(false)} />
      </>
    );
  }

  // Plusieurs listes → dropdown
  const isInAnyList = lists.some((list) =>
    list.item_count > 0 // approximation — on affiche le Check si dans la liste par défaut
  );
  void isInAnyList;

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            aria-label="Ajouter à une liste"
            className={cn(
              "flex items-center justify-center rounded-full transition-all shrink-0",
              "border border-white/30 hover:border-white/60",
              "bg-black/30 backdrop-blur-sm",
              isInDefaultList && "bg-white/15 border-white/50",
              buttonSize,
              className
            )}
          >
            {isInDefaultList ? (
              <Check className={cn(iconSize, "text-white")} />
            ) : (
              <Plus className={cn(iconSize, "text-white")} />
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-(--z-modal) min-w-50 glass-tile overflow-hidden shadow-2xl py-1"
            style={{ borderRadius: "16px" }}
            sideOffset={8}
            align="start"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <div className="px-3 py-2 text-xs font-semibold text-white/40 tracking-wider uppercase">
              Ajouter à une liste
            </div>

            {lists.map((list) => {
              const isDefaultList = list.is_default;
              const isIn = isDefaultList ? isInDefaultList : false;

              return (
                <DropdownMenu.Item
                  key={list.id}
                  onSelect={() => {
                    if (isDefaultList) {
                      toggleDefault({ tmdbId, mediaType, action: isIn ? "remove" : "add" });
                    } else {
                      toggleInList({ listId: list.id, tmdbId, mediaType, action: isIn ? "remove" : "add" });
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer",
                    "text-white/75 hover:text-white hover:bg-white/8 transition-colors outline-none",
                    "data-highlighted:bg-white/8 data-highlighted:text-white"
                  )}
                >
                  <span className="text-base leading-none shrink-0">{list.icon ?? "🎬"}</span>
                  <span className="flex-1 truncate">{list.name}</span>
                  {isIn && <Check className="size-3.5 text-nemo-accent shrink-0" />}
                  {list.members.length > 1 && (
                    <span className="text-[10px] text-white/30 shrink-0">
                      {list.members.length} membres
                    </span>
                  )}
                </DropdownMenu.Item>
              );
            })}

            <DropdownMenu.Separator className="h-px bg-white/8 my-1" />

            <DropdownMenu.Item
              onSelect={() => setCreateOpen(true)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer",
                "text-nemo-accent hover:bg-nemo-accent/10 transition-colors outline-none",
                "data-highlighted:bg-nemo-accent/10"
              )}
            >
              <Plus className="size-4 shrink-0" />
              <span>Nouvelle liste</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CreateListModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
