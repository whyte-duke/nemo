"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

const FILTERS = [
  { id: undefined, label: "Tout" },
  { id: "watched", label: "Vus" },
  { id: "liked", label: "Aimés" },
  { id: "added_to_list", label: "Listes" },
] as const;

export default function ActivitePage() {
  const [filter, setFilter] = useState<string | undefined>(undefined);

  return (
    <div className="bg-[#0b0d12] min-h-dvh">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Activity className="size-6 text-nemo-accent" />
          <h1 className="text-2xl font-black text-white">Activité</h1>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all shrink-0",
                filter === f.id
                  ? "bg-white/12 text-white"
                  : "text-white/40 hover:text-white/65 hover:bg-white/6"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        <ActivityFeed filter={filter} />
      </div>
    </div>
  );
}
