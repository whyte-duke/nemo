import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getPersonDetail,
  getPersonMovieCredits,
  getPersonTVCredits,
  tmdbImage,
} from "@/lib/tmdb/client";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const person = await getPersonDetail(Number(id));
    return {
      title: person.name,
      description: person.biography?.slice(0, 160) ?? undefined,
      openGraph: {
        title: person.name,
        images: person.profile_path
          ? [tmdbImage.profile(person.profile_path, "h632") ?? ""]
          : [],
      },
    };
  } catch {
    return { title: "Personne introuvable" };
  }
}

export default async function ActeurPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (!numId || isNaN(numId)) notFound();

  try {
    const [person, movieCredits, tvCredits] = await Promise.all([
      getPersonDetail(numId),
      getPersonMovieCredits(numId),
      getPersonTVCredits(numId),
    ]);

    const allMovies = [...new Map(movieCredits.cast.map((m) => [m.id, m])).values()]
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 20);

    const allTV = [...new Map(tvCredits.cast.map((s) => [s.id, s])).values()]
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 12);

    return (
      <article className="bg-[#080a0f] min-h-dvh pt-20">
        <div className="max-w-screen-lg mx-auto px-6 sm:px-12 py-12">
          {/* Header profil */}
          <div className="flex flex-col sm:flex-row gap-8 mb-14">
            <div className="shrink-0">
              <div className="relative size-40 sm:size-52 rounded-2xl overflow-hidden bg-[#161a24] shadow-2xl mx-auto sm:mx-0 ring-1 ring-white/10">
                {person.profile_path ? (
                  <Image
                    src={tmdbImage.profile(person.profile_path, "h632") ?? ""}
                    alt={person.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="208px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-5xl font-black">
                    {person.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4 text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-black text-white text-balance">
                {person.name}
              </h1>

              <dl className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-1 text-sm">
                {person.known_for_department && (
                  <div>
                    <dt className="text-white/40 inline">Connu pour : </dt>
                    <dd className="text-white/80 inline">{person.known_for_department}</dd>
                  </div>
                )}
                {person.birthday && (
                  <div>
                    <dt className="text-white/40 inline">Naissance : </dt>
                    <dd className="text-white/80 inline">{formatDate(person.birthday)}</dd>
                  </div>
                )}
                {person.place_of_birth && (
                  <div>
                    <dt className="text-white/40 inline">Lieu : </dt>
                    <dd className="text-white/80 inline">{person.place_of_birth}</dd>
                  </div>
                )}
              </dl>

              {person.biography && (
                <p className="text-white/70 text-sm leading-relaxed text-pretty line-clamp-6">
                  {person.biography}
                </p>
              )}
            </div>
          </div>

          {/* Filmographie */}
          {allMovies.length > 0 && (
            <section className="mb-12">
              <h2 className="text-white font-semibold text-xl mb-5 flex items-center gap-3">
                Filmographie
                <span className="section-label">{movieCredits.cast.length} films</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {allMovies.map((movie) => (
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
            </section>
          )}

          {/* Séries */}
          {allTV.length > 0 && (
            <section>
              <h2 className="text-white font-semibold text-xl mb-5 flex items-center gap-3">
                Séries
                <span className="section-label">{tvCredits.cast.length}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {allTV.map((show) => {
                  const showName =
                    (show as { name?: string; title?: string }).name ?? show.title ?? "";
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
            </section>
          )}
        </div>
      </article>
    );
  } catch {
    notFound();
  }
}
