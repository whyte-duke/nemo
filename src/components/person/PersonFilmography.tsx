"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";

const INITIAL_MOVIES = 12;
const INITIAL_TV = 8;

interface MovieCredit {
  id: number;
  poster_path: string | null;
  title: string;
  character?: string;
}

interface TVCredit {
  id: number;
  poster_path: string | null;
  name?: string;
  title?: string;
}

interface PersonFilmographyProps {
  movies: MovieCredit[];
  tvShows: TVCredit[];
  totalMovies: number;
  totalTV: number;
}

export function PersonFilmography({ movies, tvShows, totalMovies, totalTV }: PersonFilmographyProps) {
  const [moviesExpanded, setMoviesExpanded] = useState(false);
  const [tvExpanded, setTvExpanded] = useState(false);

  const visibleMovies = moviesExpanded ? movies : movies.slice(0, INITIAL_MOVIES);
  const visibleTV = tvExpanded ? tvShows : tvShows.slice(0, INITIAL_TV);

  return (
    <>
      {movies.length > 0 && (
        <section className="mb-12">
          <h2 className="text-white font-semibold text-xl mb-5 flex items-center gap-3">
            Filmographie
            <span className="section-label">{totalMovies} films</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {visibleMovies.map((movie) => (
              <Link key={`movie-${movie.id}`} href={`/film/${movie.id}`} className="group">
                <div className="relative rounded-2xl overflow-hidden aspect-2/3 bg-[#161a24] mb-2 ring-1 ring-white/8">
                  {movie.poster_path ? (
                    <Image
                      src={tmdbImage.poster(movie.poster_path, "w342") ?? ""}
                      alt={movie.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 150px, 200px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <span className="text-white/20 text-xs text-center text-balance">
                        {movie.title}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">
                  {movie.title}
                </p>
                {movie.character && (
                  <p className="text-white/40 text-xs truncate">{movie.character}</p>
                )}
              </Link>
            ))}
          </div>
          {movies.length > INITIAL_MOVIES && (
            <button
              onClick={() => setMoviesExpanded((v) => !v)}
              className="mt-4 text-nemo-accent text-sm font-semibold flex items-center gap-1"
            >
              {moviesExpanded
                ? "Voir moins"
                : `+ Voir plus (${movies.length - INITIAL_MOVIES} de plus)`}
              <ChevronDown
                className={cn("size-4 transition-transform", moviesExpanded && "rotate-180")}
              />
            </button>
          )}
        </section>
      )}

      {tvShows.length > 0 && (
        <section>
          <h2 className="text-white font-semibold text-xl mb-5 flex items-center gap-3">
            Séries
            <span className="section-label">{totalTV}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleTV.map((show) => {
              const showName = show.name ?? show.title ?? "";
              return (
                <Link key={show.id} href={`/serie/${show.id}`} className="group">
                  <div className="relative rounded-2xl overflow-hidden aspect-2/3 bg-[#161a24] mb-2 ring-1 ring-white/8">
                    {show.poster_path ? (
                      <Image
                        src={tmdbImage.poster(show.poster_path, "w342") ?? ""}
                        alt={showName}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="160px"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <span className="text-white/20 text-xs text-center text-balance">
                          {showName}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-white/80 text-xs font-medium truncate group-hover:text-white transition-colors">
                    {showName}
                  </p>
                </Link>
              );
            })}
          </div>
          {tvShows.length > INITIAL_TV && (
            <button
              onClick={() => setTvExpanded((v) => !v)}
              className="mt-4 text-nemo-accent text-sm font-semibold flex items-center gap-1"
            >
              {tvExpanded
                ? "Voir moins"
                : `+ Voir plus (${tvShows.length - INITIAL_TV} de plus)`}
              <ChevronDown
                className={cn("size-4 transition-transform", tvExpanded && "rotate-180")}
              />
            </button>
          )}
        </section>
      )}
    </>
  );
}
