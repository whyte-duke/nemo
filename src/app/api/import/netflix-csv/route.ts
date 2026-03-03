import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";

// Nombre de requêtes TMDB en parallèle (rester sous les rate limits)
const BATCH_SIZE = 5;

interface NetflixEntry {
  title: string; // déjà nettoyé côté client (extractShowName)
  date: string;  // format "YYYY-MM-DD"
}

interface TmdbResult {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
}

interface TmdbSearchResponse {
  results?: TmdbResult[];
}

/**
 * Détecte si un titre est une série TV et extrait le nom de la série.
 * Gère les formats français (Saison) et anglais (Season).
 * Ex: "Black Mirror: Saison 3: Haine virtuelle" → { show: "Black Mirror", isTV: true }
 * Ex: "1883: Faire sombrer le diable dans l'ennui" → { show: "1883", isTV: null (inconnu) }
 * Ex: "Platoon" → { show: "Platoon", isTV: false }
 */
function analyzeTitle(raw: string): { searchTitle: string; isTV: boolean | null } {
  // Cas 1 : format "Série: Saison/Season X: Épisode" → c'est clairement une série
  const seasonMatch = /^(.+?): (?:Saison|Season)\s+\d+/i.exec(raw);
  if (seasonMatch) {
    return { searchTitle: seasonMatch[1].trim(), isTV: true };
  }

  // Cas 2 : format "ShowName: SomethingElse" sans marqueur de saison
  // → on essaiera le titre complet puis le titre avant le ":"
  return { searchTitle: raw.trim(), isTV: null };
}

async function searchTmdb(query: string, year: string | null): Promise<TmdbResult | null> {
  const q = encodeURIComponent(query);
  const yearParam = year ? `&year=${year}` : "";
  const res = await fetch(
    `${TMDB_BASE}/search/multi?query=${q}${yearParam}&api_key=${TMDB_KEY}&language=fr-FR&include_adult=false`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbSearchResponse;
  return data.results?.find((r) => r.media_type !== "person") ?? null;
}

async function searchTmdbTV(query: string, year: string | null): Promise<TmdbResult | null> {
  const q = encodeURIComponent(query);
  const yearParam = year ? `&first_air_date_year=${year}` : "";
  const res = await fetch(
    `${TMDB_BASE}/search/tv?query=${q}${yearParam}&api_key=${TMDB_KEY}&language=fr-FR`
  );
  if (!res.ok) return null;
  const data = (await res.json()) as TmdbSearchResponse;
  return data.results?.[0] ?? null;
}

async function findOnTmdb(
  rawTitle: string,
  year: string | null
): Promise<{ tmdbId: number | null; mediaType: string }> {
  const { searchTitle, isTV } = analyzeTitle(rawTitle);

  // Cas 1 : série confirmée → chercher d'abord en TV
  if (isTV === true) {
    const tvResult = await searchTmdbTV(searchTitle, year);
    if (tvResult?.id) return { tmdbId: tvResult.id, mediaType: "tv" };
    // Fallback multi
    const multi = await searchTmdb(searchTitle, year);
    if (multi?.id) return { tmdbId: multi.id, mediaType: multi.media_type === "tv" ? "tv" : "movie" };
    return { tmdbId: null, mediaType: "tv" };
  }

  // Cas 2 : type inconnu (titre avec ":" mais sans saison)
  // Essayer d'abord le titre complet
  const multi = await searchTmdb(searchTitle, year);
  if (multi?.id) return { tmdbId: multi.id, mediaType: multi.media_type === "tv" ? "tv" : "movie" };

  // Si le titre contient ":", essayer la partie avant le ":"
  const colonIdx = searchTitle.indexOf(":");
  if (colonIdx > 0) {
    const beforeColon = searchTitle.substring(0, colonIdx).trim();
    const fallback = await searchTmdb(beforeColon, year);
    if (fallback?.id) return { tmdbId: fallback.id, mediaType: fallback.media_type === "tv" ? "tv" : "movie" };
  }

  // Cas 3 : film classique → recherche directe
  return { tmdbId: null, mediaType: "movie" };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { entries?: NetflixEntry[] };
  try {
    body = (await request.json()) as { entries?: NetflixEntry[] };
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const entries = body.entries ?? [];
  if (!entries.length) {
    return NextResponse.json({ error: "Aucune entrée fournie" }, { status: 400 });
  }
  if (entries.length > 5000) {
    return NextResponse.json({ error: "Trop d'entrées (max 5000)" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  let totalInserted = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    const rows = await Promise.all(
      batch.map(async (entry) => {
        // L'année vient du format "YYYY-MM-DD" — prend la première partie
        const year = entry.date?.split("-")[0] ?? null;
        const validYear = year && /^\d{4}$/.test(year) ? year : null;

        let tmdbId: number | null = null;
        let mediaType = "movie";
        try {
          const result = await findOnTmdb(entry.title, validYear);
          tmdbId = result.tmdbId;
          mediaType = result.mediaType;
        } catch {
          // Continuer même si TMDB échoue
        }

        // Convertir la date en ISO (elle est déjà "YYYY-MM-DD" depuis le client)
        let watchedAt: string | null = null;
        try {
          if (entry.date) watchedAt = new Date(entry.date + "T00:00:00Z").toISOString();
        } catch {
          watchedAt = null;
        }

        return {
          user_id: user.id,
          source: "netflix_csv",
          tmdb_id: tmdbId,
          imdb_id: null,
          media_type: mediaType,
          title: entry.title,
          watched_at: watchedAt,
          user_rating: null,
          review: null,
          raw_data: { date: entry.date },
        };
      })
    );

    // Utiliser INSERT simple (pas upsert) car l'index partiel n'est pas supporté
    // par PostgREST pour l'ON CONFLICT. La déduplication est faite côté client.
    const { error } = await supabase.from("external_watch_history").insert(rows);

    if (!error) {
      totalInserted += rows.length;
    } else if (error.code === "23505") {
      // Conflit unique (import dupliqué) → insérer ligne par ligne pour maximiser les succès
      for (const row of rows) {
        const { error: rowErr } = await supabase
          .from("external_watch_history")
          .insert(row);
        if (!rowErr) totalInserted++;
      }
    }
    // Autres erreurs : on continue le batch suivant
  }

  return NextResponse.json({ count: totalInserted });
}
