/**
 * Helpers purs pour la page Pour Vous — sans dépendances client.
 * Exportés séparément pour faciliter les tests unitaires.
 */

import { TMDB_GENRE_NAMES } from "@/lib/tmdb/genres";
import type { ScoredItem } from "@/lib/recommendations/scorer";

export type ReasonKey = "similarity" | "taste_match" | "social" | "quality" | "trending";

export type ReasonGroup = {
  reason: ReasonKey;
  /** Pour reason_type = "similarity" uniquement */
  sourceTitle?: string;
  /** Label affiché dans le sous-titre de section */
  label: string;
  items: ScoredItem[];
};

/**
 * Groupe les items par reason_type.
 * Pour "similarity", crée un groupe par sourceTitle distinct (max 2).
 * Retourne les groupes dans l'ordre d'affichage voulu.
 * Données dérivées calculées pendant le render — pas de useEffect.
 */
export function buildReasonGroups(items: ScoredItem[]): ReasonGroup[] {
  const groups: ReasonGroup[] = [];

  // 1. Sections similarity — une par sourceTitle (max 2)
  const similarityItems = items.filter((i) => i.reason_type === "similarity");
  const sourceTitlesMap = new Map<string, ScoredItem[]>();
  for (const item of similarityItems) {
    const sourceTitle = item.reason_detail?.sourceTitle ?? "un titre que vous aimez";
    if (!sourceTitlesMap.has(sourceTitle)) sourceTitlesMap.set(sourceTitle, []);
    sourceTitlesMap.get(sourceTitle)!.push(item);
  }
  let simCount = 0;
  for (const [sourceTitle, simItems] of sourceTitlesMap) {
    if (simCount >= 2) break;
    groups.push({
      reason: "similarity",
      sourceTitle,
      label: `Parce que vous avez regardé ${sourceTitle}`,
      items: simItems,
    });
    simCount++;
  }

  // 2. Sections standard dans l'ordre voulu
  const standardReasons = ["taste_match", "social", "quality", "trending"] as const;
  for (const reason of standardReasons) {
    const reasonItems = items.filter((i) => i.reason_type === reason);
    if (reasonItems.length === 0) continue;

    let label: string;
    if (reason === "taste_match") {
      const topGenre = reasonItems[0]?.reason_detail?.topGenre;
      if (topGenre) {
        const genreId = Number(topGenre);
        const genreName = TMDB_GENRE_NAMES[genreId];
        label = genreName
          ? `Correspondance avec vos goûts • ${genreName}`
          : "Correspondance avec vos goûts";
      } else {
        label = "Correspondance avec vos goûts";
      }
    } else if (reason === "social") {
      const count = reasonItems.find((i) => i.reason_detail?.friendCount !== undefined)
        ?.reason_detail?.friendCount ?? 0;
      label =
        count > 1
          ? `${count} amis ont aimé`
          : count === 1
            ? "1 ami a aimé"
            : "Aimé par vos amis";
    } else if (reason === "quality") {
      label = "Hautement noté";
    } else {
      label = "Populaire en ce moment";
    }

    groups.push({ reason, label, items: reasonItems });
  }

  return groups;
}
