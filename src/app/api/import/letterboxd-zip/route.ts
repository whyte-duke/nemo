import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Timeout Vercel : 60s max
export const maxDuration = 60;

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_BATCH = 5; // requêtes TMDB en parallèle

// ── Types Letterboxd ─────────────────────────────────────────────────────────

interface LbEntry {
  name: string;
  year: string;
  uri: string;
  watchedDate: string | null;
  rating: number | null;   // 0.5–5 → stocké ×2 = 1–10
  review: string | null;
}

// ── Parseur CSV robuste (gère les champs multilignes entre guillemets) ────────

function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"')            { inQuotes = false; }
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); field = ""; rows.push(row); row = []; }
      else                  { field += ch; }
    }
  }
  if (field || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseCSVWithHeader<T>(text: string, mapper: (row: string[], header: string[]) => T | null): T[] {
  const rows = parseCSVRows(text.trim());
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).flatMap((row) => {
    const mapped = mapper(row, header);
    return mapped ? [mapped] : [];
  });
}

function col(row: string[], header: string[], name: string): string {
  const idx = header.indexOf(name);
  return idx >= 0 ? (row[idx]?.trim() ?? "") : "";
}

// ── Parseurs par fichier ─────────────────────────────────────────────────────

function parseRatings(text: string): Map<string, LbEntry> {
  const entries = parseCSVWithHeader(text, (row, header) => {
    const name = col(row, header, "name");
    const year = col(row, header, "year");
    if (!name || !year) return null;
    const rating = parseFloat(col(row, header, "rating")) || null;
    return {
      name, year,
      uri: col(row, header, "letterboxd uri"),
      watchedDate: col(row, header, "date") || null,
      rating,
      review: null,
    } satisfies LbEntry;
  });
  const map = new Map<string, LbEntry>();
  entries.forEach((e) => map.set(`${e.name}|${e.year}`, e));
  return map;
}

function parseWatched(text: string): Map<string, LbEntry> {
  const entries = parseCSVWithHeader(text, (row, header) => {
    const name = col(row, header, "name");
    const year = col(row, header, "year");
    if (!name || !year) return null;
    return {
      name, year,
      uri: col(row, header, "letterboxd uri"),
      watchedDate: col(row, header, "date") || null,
      rating: null,
      review: null,
    } satisfies LbEntry;
  });
  const map = new Map<string, LbEntry>();
  entries.forEach((e) => map.set(`${e.name}|${e.year}`, e));
  return map;
}

function parseReviews(text: string): Map<string, { review: string; rating: number | null }> {
  const entries = parseCSVWithHeader(text, (row, header) => {
    const name = col(row, header, "name");
    const year = col(row, header, "year");
    const review = col(row, header, "review");
    if (!name || !year || !review) return null;
    const rating = parseFloat(col(row, header, "rating")) || null;
    return { key: `${name}|${year}`, review, rating };
  });
  const map = new Map<string, { review: string; rating: number | null }>();
  entries.forEach((e) => map.set(e.key, { review: e.review, rating: e.rating }));
  return map;
}

function parseDiary(text: string): Map<string, LbEntry> {
  const entries = parseCSVWithHeader(text, (row, header) => {
    const name = col(row, header, "name");
    const year = col(row, header, "year");
    if (!name || !year) return null;
    const ratingRaw = col(row, header, "rating");
    const rating = ratingRaw ? parseFloat(ratingRaw) || null : null;
    return {
      name, year,
      uri: col(row, header, "letterboxd uri"),
      watchedDate: col(row, header, "watched date") || col(row, header, "date") || null,
      rating,
      review: null,
    } satisfies LbEntry;
  });
  const map = new Map<string, LbEntry>();
  entries.forEach((e) => {
    // Ne pas écraser les entrées existantes (diary peut avoir des doublons par rewatches)
    if (!map.has(`${e.name}|${e.year}`)) map.set(`${e.name}|${e.year}`, e);
  });
  return map;
}

/**
 * Merge toutes les sources Letterboxd en une seule Map déduplication :
 * watched < diary < ratings (priorité croissante pour les notes)
 * reviews viennent enrichir la Map finale
 */
function mergeSources(
  watched: Map<string, LbEntry>,
  diary: Map<string, LbEntry>,
  ratings: Map<string, LbEntry>,
  reviews: Map<string, { review: string; rating: number | null }>
): LbEntry[] {
  const merged = new Map<string, LbEntry>(watched);

  // diary enrichit watched (mais ne l'écrase que si il a plus d'infos)
  diary.forEach((entry, key) => {
    const existing = merged.get(key);
    if (!existing || (!existing.rating && entry.rating)) {
      merged.set(key, { ...existing, ...entry });
    }
  });

  // ratings override tout (source la plus fiable pour la note)
  ratings.forEach((entry, key) => {
    const existing = merged.get(key);
    merged.set(key, { ...(existing ?? {}), ...entry } as LbEntry);
  });

  // Ajouter les reviews
  reviews.forEach(({ review, rating }, key) => {
    const entry = merged.get(key);
    if (entry) {
      entry.review = review;
      if (!entry.rating && rating) entry.rating = rating;
    }
  });

  return Array.from(merged.values());
}

// ── Recherche TMDB ───────────────────────────────────────────────────────────

interface TmdbMovieResult {
  id: number;
  title?: string;
  name?: string;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
}

interface TmdbSearchResponse {
  results?: TmdbMovieResult[];
}

async function findTmdb(
  name: string,
  year: string
): Promise<{ tmdbId: number; mediaType: string } | null> {
  const q = encodeURIComponent(name);

  // 1. Recherche film avec l'année exacte
  try {
    const r1 = await fetch(
      `${TMDB_BASE}/search/movie?query=${q}&primary_release_year=${year}&api_key=${TMDB_KEY}&language=fr-FR`
    );
    if (r1.ok) {
      const d1 = (await r1.json()) as TmdbSearchResponse;
      if (d1.results?.length) return { tmdbId: d1.results[0].id, mediaType: "movie" };
    }
  } catch { /* continue */ }

  // 2. Recherche multi (film ou série) avec l'année
  try {
    const r2 = await fetch(
      `${TMDB_BASE}/search/multi?query=${q}&year=${year}&api_key=${TMDB_KEY}&language=fr-FR`
    );
    if (r2.ok) {
      const d2 = (await r2.json()) as TmdbSearchResponse;
      const first = d2.results?.find((r) => r.media_type !== "person");
      if (first) return { tmdbId: first.id, mediaType: first.media_type === "tv" ? "tv" : "movie" };
    }
  } catch { /* continue */ }

  // 3. Fallback sans l'année
  try {
    const r3 = await fetch(
      `${TMDB_BASE}/search/multi?query=${q}&api_key=${TMDB_KEY}&language=fr-FR`
    );
    if (r3.ok) {
      const d3 = (await r3.json()) as TmdbSearchResponse;
      const first = d3.results?.find((r) => r.media_type !== "person");
      if (first) return { tmdbId: first.id, mediaType: first.media_type === "tv" ? "tv" : "movie" };
    }
  } catch { /* continue */ }

  return null;
}

// ── Route principale ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });

  const fileName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  let ratingsText = "";
  let watchedText = "";
  let reviewsText = "";
  let diaryText = "";

  // ── Extraction ZIP ou CSV direct ──────────────────────────────────────────
  if (fileName.endsWith(".zip")) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return NextResponse.json({ error: "Impossible d'ouvrir le fichier ZIP" }, { status: 400 });
    }

    // Chercher les fichiers CSV dans le zip (même dans un sous-dossier)
    const findFile = (name: string): JSZip.JSZipObject | null => {
      let found: JSZip.JSZipObject | null = null;
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.endsWith(`/${name}`) || relativePath === name) {
          found = zipEntry;
        }
      });
      return found;
    };

    const ratingsFile  = findFile("ratings.csv");
    const watchedFile  = findFile("watched.csv");
    const reviewsFile  = findFile("reviews.csv");
    const diaryFile    = findFile("diary.csv");

    if (!ratingsFile && !watchedFile && !diaryFile) {
      return NextResponse.json({
        error: "Le ZIP ne contient pas de fichier Letterboxd reconnu (ratings.csv, watched.csv ou diary.csv)",
      }, { status: 400 });
    }

    if (ratingsFile) ratingsText = await (ratingsFile as JSZip.JSZipObject).async("text");
    if (watchedFile) watchedText = await (watchedFile as JSZip.JSZipObject).async("text");
    if (reviewsFile) reviewsText = await (reviewsFile as JSZip.JSZipObject).async("text");
    if (diaryFile)   diaryText   = await (diaryFile as JSZip.JSZipObject).async("text");

  } else if (fileName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    // Détecter le type de fichier CSV par l'en-tête
    const firstLine = text.split("\n")[0]?.toLowerCase() ?? "";
    if (firstLine.includes("rating") && !firstLine.includes("rewatch")) {
      ratingsText = text;
    } else if (firstLine.includes("rewatch")) {
      diaryText = text;
    } else {
      watchedText = text;
    }
  } else {
    return NextResponse.json({
      error: "Format non supporté. Uploadez le fichier .zip Letterboxd ou un fichier .csv (ratings.csv, diary.csv)"
    }, { status: 400 });
  }

  // ── Merge de toutes les sources ───────────────────────────────────────────
  const ratingsMap = ratingsText ? parseRatings(ratingsText) : new Map<string, LbEntry>();
  const watchedMap = watchedText ? parseWatched(watchedText) : new Map<string, LbEntry>();
  const reviewsMap = reviewsText ? parseReviews(reviewsText) : new Map<string, { review: string; rating: number | null }>();
  const diaryMap   = diaryText   ? parseDiary(diaryText)     : new Map<string, LbEntry>();

  const entries = mergeSources(watchedMap, diaryMap, ratingsMap, reviewsMap);

  if (!entries.length) {
    return NextResponse.json({ error: "Aucun film trouvé dans les fichiers", count: 0 });
  }

  // ── Enrichissement TMDB + insertion Supabase ──────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  let totalInserted = 0;

  for (let i = 0; i < entries.length; i += TMDB_BATCH) {
    const batch = entries.slice(i, i + TMDB_BATCH);

    const rows = await Promise.all(
      batch.map(async (entry) => {
        let tmdbId: number | null = null;
        let mediaType = "movie";

        try {
          const tmdb = await findTmdb(entry.name, entry.year);
          if (tmdb) { tmdbId = tmdb.tmdbId; mediaType = tmdb.mediaType; }
        } catch { /* continuer sans ID */ }

        // Convertir la date ISO (format Letterboxd : "YYYY-MM-DD")
        let watchedAt: string | null = null;
        if (entry.watchedDate) {
          try { watchedAt = new Date(entry.watchedDate + "T00:00:00Z").toISOString(); } catch { /* skip */ }
        }

        return {
          user_id: user.id,
          source: "letterboxd",
          tmdb_id: tmdbId,
          imdb_id: null,
          media_type: mediaType,
          title: entry.name,
          watched_at: watchedAt,
          user_rating: entry.rating !== null ? entry.rating * 2 : null, // 0.5-5 → 1-10
          review: entry.review ?? null,
          raw_data: {
            year: entry.year,
            lb_uri: entry.uri,
            lb_rating: entry.rating,
          },
        };
      })
    );

    // INSERT avec fallback ligne-par-ligne sur conflit
    const { error } = await supabase.from("external_watch_history").insert(rows);
    if (!error) {
      totalInserted += rows.length;
    } else if (error.code === "23505") {
      for (const row of rows) {
        const { error: rowErr } = await supabase.from("external_watch_history").insert(row);
        if (!rowErr) totalInserted++;
      }
    }
  }

  return NextResponse.json({
    count: totalInserted,
    total: entries.length,
    notMatched: entries.length - totalInserted,
  });
}
