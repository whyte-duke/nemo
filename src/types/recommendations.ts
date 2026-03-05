// Types de transport pour le système de recommandation.
// Pas d'import server-only — ces types sont utilisables côté client (Phase 05 UI).

export type ReasonType = "taste_match" | "social" | "trending" | "quality" | "similarity";

/**
 * Contexte enrichi pour afficher des labels Spotify-style dans l'UI.
 * Tous les champs sont optionnels — seul le sous-ensemble pertinent est rempli
 * selon le reason_type correspondant.
 *
 * - similarity  → sourceTitle + sourceTmdbId
 * - taste_match → topGenre
 * - social      → friendCount
 * - quality / trending → aucun champ supplémentaire
 */
export interface ReasonDetail {
  /** Pour reason_type === "similarity" : titre du film/série source */
  sourceTitle?: string;
  /** Pour reason_type === "similarity" : tmdb_id de l'item source */
  sourceTmdbId?: number;
  /** Pour reason_type === "social" : nombre d'amis ayant liké */
  friendCount?: number;
  /** Pour reason_type === "taste_match" : genre dominant (id en string, ex: "28") */
  topGenre?: string;
}

/** Données de similarité enrichies produites pour un candidat donné.
 *  score       : score de similarité normalisé [0, 1]
 *  sourceTitle : titre du film/série source (le liked item qui a généré la similarité)
 *  sourceTmdbId: tmdb_id du film/série source
 */
export interface SimilarityData {
  score: number;
  sourceTitle: string;
  sourceTmdbId: number;
}
