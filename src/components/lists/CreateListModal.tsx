"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCreateList } from "@/hooks/use-lists";
import { useFriends } from "@/hooks/use-friends";
import Image from "next/image";
import { tmdbImage } from "@/lib/tmdb/client";

const PRESET_ICONS = [
  "🎬", "🎭", "🍿", "⭐", "🔥", "💫", "🎯", "🎪",
  "🌟", "🎥", "📽️", "🎞️", "🏆", "💎", "🚀", "🌙",
  "🎸", "🧨", "🎃", "👻", "🦁", "🐉", "🌺", "🎨",
];

function randomIcon(): string {
  return PRESET_ICONS[Math.floor(Math.random() * PRESET_ICONS.length)];
}

interface CreateListModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (listId: string) => void;
}

export function CreateListModal({ open, onClose, onCreated }: CreateListModalProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(randomIcon());
  const [customIcon, setCustomIcon] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  const { mutate: createList, isPending } = useCreateList();
  const { data: friends = [] } = useFriends();

  const icon = customIcon.trim() || selectedIcon;

  function resetForm() {
    setName("");
    setSelectedIcon(randomIcon());
    setCustomIcon("");
    setSelectedFriends([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createList(
      { name: name.trim(), icon, friendIds: selectedFriends },
      {
        onSuccess: (data: { id: string }) => {
          onCreated?.(data.id);
          resetForm();
          onClose();
        },
      }
    );
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-(--z-overlay)"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 flex items-center justify-center p-4 z-(--z-modal)"
              >
                <div className="glass-tile w-full max-w-md overflow-hidden shadow-2xl" style={{ borderRadius: "20px" }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
                    <Dialog.Title className="text-white font-bold text-lg">
                      Nouvelle liste
                    </Dialog.Title>
                    <Dialog.Close className="flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
                      <X className="size-4" />
                    </Dialog.Close>
                  </div>

                  <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Aperçu + Nom */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center size-16 rounded-2xl bg-white/8 border border-white/10 text-3xl shrink-0 select-none">
                        {icon}
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-white/40 mb-1.5 font-medium">Nom de la liste</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value.slice(0, 30))}
                          placeholder="Ma liste de films..."
                          maxLength={30}
                          className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/30 text-sm outline-none focus:border-white/30 transition-colors"
                          required
                          autoFocus
                        />
                        <p className="text-right text-[10px] text-white/25 mt-1">{name.length}/30</p>
                      </div>
                    </div>

                    {/* Sélecteur d'icône */}
                    <div>
                      <label className="block text-xs text-white/40 mb-2 font-medium">Icône</label>
                      <div className="grid grid-cols-8 gap-1.5 mb-2">
                        {PRESET_ICONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => { setSelectedIcon(emoji); setCustomIcon(""); }}
                            className={cn(
                              "flex items-center justify-center size-9 rounded-xl text-lg transition-all",
                              "hover:bg-white/12",
                              selectedIcon === emoji && !customIcon
                                ? "bg-nemo-accent/20 ring-1 ring-nemo-accent/50"
                                : "bg-white/6"
                            )}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={customIcon}
                        onChange={(e) => setCustomIcon(e.target.value.slice(0, 2))}
                        placeholder="Ou tape ton propre emoji…"
                        className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-white placeholder:text-white/30 text-sm outline-none focus:border-white/30 transition-colors"
                      />
                    </div>

                    {/* Partager avec des amis */}
                    {friends.length > 0 && (
                      <div>
                        <label className="block text-xs text-white/40 mb-2 font-medium">
                          Partager avec des amis
                          <span className="text-white/20 ml-1">(facultatif)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {friends.map((friend) => {
                            const selected = selectedFriends.includes(friend.id);
                            return (
                              <button
                                key={friend.id}
                                type="button"
                                onClick={() => toggleFriend(friend.id)}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                  selected
                                    ? "bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/30"
                                    : "bg-white/8 text-white/60 border border-white/10 hover:border-white/25 hover:text-white"
                                )}
                              >
                                <div className="relative size-5 rounded-full overflow-hidden bg-white/10 shrink-0">
                                  {friend.avatar_url ? (
                                    <Image
                                      src={tmdbImage.poster(friend.avatar_url, "w185") ?? friend.avatar_url}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="20px"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white/50 font-bold">
                                      {(friend.display_name ?? "?").charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <span className="truncate max-w-20">{friend.display_name ?? "Ami"}</span>
                                {selected && <Check className="size-3 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/60 hover:text-white hover:bg-white/8 transition-colors text-sm font-medium"
                        >
                          Annuler
                        </button>
                      </Dialog.Close>
                      <button
                        type="submit"
                        disabled={!name.trim() || isPending}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                          name.trim() && !isPending
                            ? "bg-nemo-accent hover:bg-[#f0c85a] text-black shadow-lg shadow-amber-500/20"
                            : "bg-white/10 text-white/30 cursor-not-allowed"
                        )}
                      >
                        {isPending ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-4 rounded-full border-2 border-black/30 border-t-black/70 animate-spin" />
                            Création…
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-1.5">
                            <Plus className="size-4" />
                            Créer la liste
                          </span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
