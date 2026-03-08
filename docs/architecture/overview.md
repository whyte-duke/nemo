# Architecture de Nemo

> Derniere mise a jour : 2026-03-04 | Source : analyse du codebase reel

## Resume rapide

Nemo est une plateforme sociale de streaming construite avec **Next.js 16** (App Router), **React 19**, **Supabase** (PostgreSQL + Auth), **TanStack Query** et **Tailwind CSS 4**. L'application permet de decouvrir, noter et regarder des films et series via un systeme de recommandation personnalise, avec integration de serveurs Jellyfin personnels et de services de debridage (AllDebrid/RealDebrid) via StreamFusion.

Le projet utilise des **routes en francais** (`/decouvrir`, `/amis`, `/ma-liste`), des composants animes avec **Motion** (Framer Motion), et un design sombre "glass morphism" avec des gradients ambiants.

---

## Stack Technique

| Couche | Technologie | Version |
|--------|------------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React + React DOM | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| Animations | Motion (Framer Motion) | 12.x |
| Base de donnees | Supabase (PostgreSQL + Auth) | supabase-js 2.98+ |
| State client | TanStack React Query | 5.90+ |
| Icones | Lucide React | 0.576+ |
| Composants UI | Radix UI (dialog, dropdown, tabs, slider, tooltip, avatar, progress, scroll-area) | - |
| Video | hls.js + Plyr | - |
| Typage | TypeScript | 5.x |

---

## Arborescence du Projet

```
src/
├── app/                          # Routes Next.js App Router
│   ├── layout.tsx                # Root layout : providers globaux (Query, Auth, Jellyfin, Stream)
│   ├── globals.css               # Design system : variables CSS, transitions, couleurs
│   ├── manifest.ts               # PWA manifest
│   ├── favicon.ico               # Icone du site
│   ├── apple-icon.tsx            # Icone Apple generee dynamiquement
│   ├── opengraph-image.tsx       # Image OG generee dynamiquement
│   │
│   ├── (auth)/                   # Route group -- pages publiques (pas de Navbar)
│   │   ├── layout.tsx            #   Layout auth : fond anime, pas de navigation
│   │   ├── connexion/page.tsx    #   Page de connexion email/password
│   │   └── inscription/page.tsx  #   Page d'inscription avec code d'invitation
│   │
│   ├── (main)/                   # Route group -- pages protegees (avec Navbar)
│   │   ├── layout.tsx            #   Layout principal : Navbar + gradient blobs + providers recommendations
│   │   ├── page.tsx              #   Accueil : hero cinematique + rangees personnalisees
│   │   ├── films/page.tsx        #   Catalogue films (populaires, top rated, a venir)
│   │   ├── series/page.tsx       #   Catalogue series
│   │   ├── decouvrir/page.tsx    #   Mode swipe Tinder-like pour decouvrir des medias
│   │   ├── pour-vous/page.tsx    #   Recommandations personnalisees
│   │   ├── recherche/page.tsx    #   Recherche multi (films, series, personnes)
│   │   ├── ma-liste/page.tsx     #   Liste personnelle de l'utilisateur
│   │   ├── historique/page.tsx   #   Historique de visionnage
│   │   ├── amis/page.tsx         #   Liste d'amis et demandes
│   │   ├── activite/page.tsx     #   Fil d'activite social
│   │   ├── film/[id]/page.tsx    #   Detail d'un film (avec streaming)
│   │   ├── serie/[id]/page.tsx   #   Detail d'une serie (avec episodes)
│   │   ├── acteur/[id]/page.tsx  #   Filmographie d'un acteur
│   │   ├── hub/                  #   Contenus par plateforme (Netflix, Disney+...)
│   │   │   ├── [provider]/page.tsx
│   │   │   └── jellyfin/page.tsx #     Hub Jellyfin specifique
│   │   ├── profil/               #   Espace utilisateur
│   │   │   ├── [userId]/page.tsx #     Profil public d'un utilisateur
│   │   │   ├── parametres/page.tsx #   Parametres du compte
│   │   │   ├── notifications/page.tsx
│   │   │   └── enrichir/page.tsx #     Import de donnees (Letterboxd, Netflix, Trakt)
│   │   └── trouve-un-film/       #   Film Finder (recherche assistee)
│   │       ├── layout.tsx
│   │       └── page.tsx
│   │
│   ├── onboarding/               # Parcours d'accueil (hors route groups)
│   │   ├── layout.tsx
│   │   └── page.tsx              #   7 etapes : bienvenue, import, services, streaming, decouverte, amis, fin
│   │
│   └── api/                      # 58 route handlers REST
│       ├── auth/                 #   Authentification et OAuth
│       │   ├── me/route.ts       #     Utilisateur courant
│       │   ├── logout/route.ts   #     Deconnexion
│       │   ├── letterboxd/       #     OAuth Letterboxd (redirect + callback)
│       │   └── trakt/            #     OAuth Trakt (redirect + callback)
│       ├── interactions/         #   Likes/dislikes sur les medias (3 routes)
│       ├── lists/                #   Listes collaboratives CRUD (5 routes)
│       ├── friends/              #   Systeme d'amis (8 routes)
│       ├── jellyfin/             #   Integration Jellyfin (8 routes)
│       ├── download/             #   Telechargement via debrideurs (4 routes)
│       ├── import/               #   Import depuis services externes (5 routes)
│       ├── invite/               #   Systeme d'invitation (3 routes)
│       ├── streaming/[imdbId]/   #   Disponibilite streaming (RapidAPI)
│       ├── recommendations/      #   Moteur de recommandation
│       ├── taste-profile/        #   Profil de gout utilisateur
│       ├── discover/cards/       #   Cartes de decouverte (mode swipe)
│       ├── media-features/fetch/ #   Features TMDB pour le scoring
│       ├── activity/             #   Fil d'activite social
│       ├── historique/           #   Historique de visionnage
│       ├── my-list/              #   Liste personnelle
│       ├── suggestions-list/     #   Suggestions de listes
│       ├── watch-history/        #   Historique (variant)
│       ├── profile/              #   Mise a jour du profil
│       ├── finder/suggest/       #   Suggestions Film Finder
│       ├── webhook-receiver/     #   Recepteur webhook generique
│       ├── webhooks/jellyfin/    #   Webhook Jellyfin
│       └── dev/                  #   Outils dev (reset-onboarding)
│
├── components/                   # 42 composants React dans 14 sous-dossiers
│   ├── activity/                 #   ActivityFeed
│   ├── discover/                 #   SwipeStack, SwipeCard, DiscoverOnboarding
│   ├── download/                 #   DownloadModal, SeasonDownloadModal
│   ├── films/                    #   FilmsContent
│   ├── friends/                  #   FriendCard
│   ├── hero/                     #   HeroCinematic
│   ├── home/                     #   HomeContent, PersonalizedRow, UserListRows
│   ├── hub/                      #   HubContent, JellyfinHubContent
│   ├── icons/                    #   JellyfinIcon
│   ├── invite/                   #   InviteModal
│   ├── lists/                    #   CreateListModal, ListSelector, ListPickerSheet
│   ├── media/                    #   MediaCard, MediaRow, MovieDetailContent, TVDetailContent, StreamingServices, DetailModal
│   ├── navigation/               #   Navbar
│   ├── onboarding/               #   OnboardingShell, Step* (7 etapes)
│   ├── person/                   #   PersonFilmography
│   ├── player/                   #   WatchModal, MovieWatchModal, StreamModal, VideoPlayer
│   ├── search/                   #   SearchContent
│   ├── series/                   #   SeriesContent
│   └── ui/                       #   ProviderLogo
│
├── contexts/                     # Contextes React
│   └── jellyfin-library-context.tsx  # Cache bibliotheque Jellyfin (tmdbId -> jellyfinId)
│
├── hooks/                        # 13 hooks personnalises (TanStack Query)
│   ├── use-auth.ts               #   Session Supabase + souscription realtime
│   ├── use-profile.ts            #   Profil utilisateur
│   ├── use-tmdb.ts               #   Recherche et details TMDB
│   ├── use-list.ts               #   Operations sur une liste
│   ├── use-lists.ts              #   Liste des listes
│   ├── use-friends.ts            #   Amis et demandes
│   ├── use-watch-history.ts      #   Historique de visionnage
│   ├── use-swipe-session.ts      #   Session de decouverte (swipe)
│   ├── use-streaming-availability.ts  # Disponibilite sur les plateformes
│   ├── use-streaming-preferences.ts   # Preferences de streaming (debrideur)
│   ├── use-jellyfin-auth.ts      #   Authentification Jellyfin
│   ├── use-jellyfin-library.ts   #   Bibliotheque Jellyfin
│   └── use-downloads.ts          #   File de telechargement
│
├── lib/                          # Logique metier et clients externes
│   ├── auth/                     #   Authentification
│   │   ├── session.ts            #     getAuthUser(), getAuthUserWithRole(), requireRole()
│   │   └── jellyfin-session.ts   #     Session Jellyfin (cookie-based)
│   ├── supabase/                 #   Clients Supabase (3 variantes)
│   │   ├── server.ts             #     Client server (cookies, RLS actif)
│   │   ├── client.ts             #     Client browser (singleton, RLS actif)
│   │   ├── admin.ts              #     Client admin (service role, bypass RLS)
│   │   └── middleware.ts         #     updateSession() pour le middleware Next.js
│   ├── tmdb/                     #   Integration TMDB
│   │   ├── client.ts             #     40+ fonctions : trending, discover, detail, search, genres
│   │   ├── features.ts           #     Extraction de features (cast, directors, keywords) pour le scoring
│   │   └── genres.ts             #     Mapping genre_id -> nom francais
│   ├── jellyfin/                 #   Integration Jellyfin
│   │   ├── client.ts             #     Client statique + createJellyfinClient() dynamique
│   │   └── sync.ts               #     Synchronisation bibliotheque Jellyfin -> Supabase
│   ├── recommendations/          #   Systeme de recommandation
│   │   ├── scorer.ts             #     scoreItem() : taste (0.45) + social (0.20) + trending (0.10) + quality (0.05)
│   │   ├── taste-profile.ts      #     Profil de gout : scores par genre, realisateur, acteur, keyword
│   │   ├── context.tsx           #     RecommendationsProvider (React context)
│   │   └── user-interactions-context.tsx  # UserInteractionsProvider (likes/dislikes en memoire)
│   ├── stremio/                  #   Integration StreamFusion
│   │   └── resolver.ts           #     fetchStreams(), parseStreams() -- resolution de flux via Stremio addon
│   ├── utils.ts                  #   Utilitaires (cn, etc.)
│   ├── m3u.ts                    #   Generation de playlists M3U
│   ├── streaming-services-catalog.ts  # Catalogue des services de streaming (Netflix, Disney+...)
│   └── provider-logos.ts         #   Logos des providers de streaming
│
├── providers/                    # Providers React globaux (root layout)
│   ├── auth-provider.tsx         #   Authentification Supabase (session realtime)
│   ├── query-provider.tsx        #   TanStack Query (QueryClient + DevTools)
│   └── stream-provider.tsx       #   Contexte de streaming (modal de lecture)
│
├── types/                        # Types TypeScript par domaine
│   ├── supabase.ts               #   Types generes Supabase (Database, tables, enums)
│   ├── tmdb.ts                   #   Types TMDB (Movie, TVShow, Person, Season, Episode...)
│   ├── jellyfin.ts               #   Types Jellyfin (AuthResult, User, Items, Playback...)
│   ├── stremio.ts                #   Types Stremio/StreamFusion (streams, config, qualite...)
│   └── download.ts               #   Types de telechargement (queue, statut)
│
└── proxy.ts                      # Proxy CORS pour les flux streaming
```

---

## Flux de Donnees Principal

```
 Navigateur (React 19)
 ┌─────────────────────────────────────────────────────────────┐
 │  Providers: QueryProvider > AuthProvider > JellyfinLibrary  │
 │  > StreamProvider > RecommendationsProvider                 │
 │                                                             │
 │  Hooks (TanStack Query) ──── fetch() ──────┐               │
 │  use-tmdb, use-friends,                     │               │
 │  use-lists, use-auth...                     │               │
 └─────────────────────────────────┬───────────┘               │
                                   │                           │
                                   v                           │
 Serveur Next.js                                               │
 ┌─────────────────────────────────────────────────────────────┐
 │                                                             │
 │  src/app/api/**/route.ts  (58 route handlers)               │
 │  ┌─────────────────────────────────────────┐                │
 │  │  1. getAuthUser()     -- verifier JWT   │                │
 │  │  2. Valider params    -- searchParams   │                │
 │  │  3. Appeler service   -- lib/*          │                │
 │  │  4. NextResponse.json()                 │                │
 │  └──────────┬──────────────────────────────┘                │
 │             │                                               │
 │             v                                               │
 │  src/lib/                                                   │
 │  ┌──────────────────────────────────────────────────────┐   │
 │  │  auth/session.ts    -- JWT cookie verification       │   │
 │  │  supabase/admin.ts  -- service role client           │   │
 │  │  tmdb/client.ts     -- fetch TMDB avec cache 1h      │   │
 │  │  stremio/resolver.ts -- fetch StreamFusion           │   │
 │  │  jellyfin/client.ts -- Jellyfin API                  │   │
 │  │  recommendations/   -- scoring algorithme            │   │
 │  └──────────┬───────────────────┬───────────────────────┘   │
 │             │                   │                           │
 └─────────────┼───────────────────┼───────────────────────────┘
               │                   │
               v                   v
 ┌─────────────────┐  ┌──────────────────────────────────┐
 │  Supabase       │  │  Services Externes               │
 │  ┌───────────┐  │  │  ┌────────────┐ ┌─────────────┐ │
 │  │ PostgreSQL│  │  │  │ TMDB API   │ │ StreamFusion│ │
 │  │ (+ RLS)   │  │  │  └────────────┘ └─────────────┘ │
 │  ├───────────┤  │  │  ┌────────────┐ ┌─────────────┐ │
 │  │ Auth      │  │  │  │ Jellyfin   │ │ RapidAPI    │ │
 │  │ (JWT)     │  │  │  └────────────┘ │(Streaming   │ │
 │  └───────────┘  │  │                 │ Availability│ │
 └─────────────────┘  │  ┌────────────┐ └─────────────┘ │
                      │  │ AllDebrid / │                 │
                      │  │ RealDebrid  │                 │
                      │  └────────────┘                 │
                      └──────────────────────────────────┘
```

---

## Patterns de Code

### 1. Authentification dans les Route Handlers

Chaque route handler commence par verifier l'authentification via `getAuthUser()`. Cette fonction lit le JWT depuis les cookies sans appel reseau.

```typescript
// src/lib/auth/session.ts
export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

Le systeme de roles (`free < sources < vip < admin`) est gere par `getAuthUserWithRole()` qui lit la table `profiles` via le client admin (bypass RLS).

### 2. Creation du Client Supabase (3 variantes)

| Variante | Fichier | Usage | RLS |
|----------|---------|-------|-----|
| **Server** | `lib/supabase/server.ts` | Server Components, Route Handlers | Actif |
| **Browser** | `lib/supabase/client.ts` | Client Components (singleton) | Actif |
| **Admin** | `lib/supabase/admin.ts` | Operations privilegiees (service role) | Desactive |

Le client server utilise `@supabase/ssr` avec les cookies Next.js. Le client admin utilise `SUPABASE_SERVICE_ROLE_KEY` et ne persiste pas la session.

### 3. Structure d'un Route Handler Typique

```typescript
// Pattern standard observe dans src/app/api/interactions/route.ts
export async function GET(request: Request) {
  // 1. Authentification
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecte" }, { status: 401 });

  // 2. Validation des parametres
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  if (!tmdbId) return NextResponse.json({ error: "Parametres manquants" }, { status: 400 });

  // 3. Appel base de donnees (via client admin)
  const supabase = createAdminClient();
  const { data } = await supabase.from("interactions").select("type")...

  // 4. Reponse JSON
  return NextResponse.json({ type: data?.type ?? null });
}
```

### 4. Middleware (Session et Redirections)

Le middleware (`src/lib/supabase/middleware.ts`, appele depuis `updateSession()`) gere :
- **Rafraichissement du JWT** Supabase a chaque requete
- **Redirection vers `/connexion`** si page protegee sans auth
- **Redirection vers `/`** si page auth avec session active
- **Verification onboarding** : redirige vers `/onboarding` si le profil n'est pas complete (avec cookie de court-circuit `nemo_onboarding_done` pour eviter un appel DB a chaque requete)

### 5. Hooks avec TanStack Query

Les hooks utilisent `useQuery` et `useMutation` de TanStack Query pour gerer le cache client, les requetes et les mutations. Ils appellent les route handlers via `fetch()`.

### 6. Systeme de Recommandation

Le scoring utilise une formule ponderee :
- **0.45** : taste score (genres, realisateurs, acteurs, keywords)
- **0.20** : social score (amis qui ont aime)
- **0.10** : trending score (popularite TMDB normalisee)
- **0.05** : quality score (note moyenne ponderee par nombre de votes)

Fichiers : `lib/recommendations/scorer.ts`, `lib/recommendations/taste-profile.ts`

---

## Conventions du Projet

### Nommage

- **Routes en francais** : `/decouvrir`, `/amis`, `/ma-liste`, `/historique`, `/connexion`, `/inscription`, `/pour-vous`, `/trouve-un-film`, `/serie`, `/acteur`, `/profil/parametres`, `/profil/enrichir`
- **Messages d'erreur en francais** : `"Non connecte"`, `"Parametres manquants"`, `"Corps invalide"`
- **Commentaires en francais** dans le code
- **Types TypeScript** nommes par domaine dans `src/types/` : `supabase.ts`, `tmdb.ts`, `jellyfin.ts`, `stremio.ts`, `download.ts`

### Structure de fichiers

- **Route groups** : `(auth)` pour les pages publiques, `(main)` pour les pages protegees
- **Composants** organises par fonctionnalite : `components/discover/`, `components/media/`, `components/player/`
- **Hooks** prefixes `use-` dans `src/hooks/`
- **Lib** organise par service : `lib/supabase/`, `lib/tmdb/`, `lib/jellyfin/`, `lib/stremio/`

### Patterns React

- **Root Layout** : chaine de providers `QueryProvider > AuthProvider > JellyfinLibraryProvider > StreamProvider`
- **Main Layout** : ajoute `UserInteractionsProvider > RecommendationsProvider` + `Navbar`
- **Design** : theme sombre (`#080a0f`), gradient blobs en arriere-plan, "glass morphism"
- **Animations** : Motion (Framer Motion) pour les transitions et les interactions (swipe, modals)

---

## Services Externes

| Service | Base URL | Usage | Fichier |
|---------|----------|-------|---------|
| **TMDB** | `api.themoviedb.org/3` | Catalogue films/series, metadonnees, images, videos | `src/lib/tmdb/client.ts` |
| **Supabase** | configurable | PostgreSQL + Auth (JWT) + Realtime | `src/lib/supabase/*.ts` |
| **StreamFusion** | `stream-fusion.stremiofr.com` | Resolution de flux streaming via addon Stremio | `src/lib/stremio/resolver.ts` |
| **Jellyfin** | configurable | Bibliotheque media personnelle, streaming direct | `src/lib/jellyfin/client.ts` |
| **AllDebrid** | via StreamFusion | Debridage de liens pour telechargement/streaming | `src/lib/stremio/resolver.ts` |
| **RealDebrid** | via StreamFusion | Debridage de liens (alternative) | `src/lib/stremio/resolver.ts` |
| **RapidAPI** | `streaming-availability.p.rapidapi.com` | Disponibilite sur plateformes (Netflix, Disney+...) | `src/app/api/streaming/[imdbId]/route.ts` |
| **Letterboxd** | OAuth | Import de notes et historique | `src/app/api/auth/letterboxd/` |
| **Trakt** | OAuth | Import d'historique de visionnage | `src/app/api/auth/trakt/` |
| **Nemo Downloader** | configurable | API de telechargement via debrideurs | `src/app/api/download/` |

---

## Variables d'Environnement

### Publiques (exposees au navigateur)

| Variable | Description | Defaut |
|----------|-------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | `https://placeholder.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anonyme Supabase | `placeholder-key` |
| `NEXT_PUBLIC_TMDB_API_KEY` | Cle API TMDB v3 | - |
| `NEXT_PUBLIC_TMDB_BASE_URL` | URL de base TMDB | `https://api.themoviedb.org/3` |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'application | `https://nemo.laubier.online` |
| `NEXT_PUBLIC_JELLYFIN_URL` | URL du serveur Jellyfin principal | - |
| `NEXT_PUBLIC_STREAMFUSION_BASE` | URL de l'addon StreamFusion | `https://stream-fusion.stremiofr.com` |
| `NEXT_PUBLIC_STREAMFUSION_API_KEY` | Cle API addon StreamFusion | - |
| `NEXT_PUBLIC_ALLDEBRID_TOKEN` | Token AllDebrid (debridage via StreamFusion) | - |
| `NEXT_PUBLIC_DOWNLOAD_API_URL` | URL de l'API de telechargement | `http://localhost:8181/api` |
| `NEXT_PUBLIC_TRAKT_ENABLED` | Active l'import Trakt dans l'onboarding | - |

### Privees (serveur uniquement)

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Cle service role Supabase (bypass RLS) |
| `JELLYFIN_API_KEY` | Cle API Jellyfin (operations serveur sans session) |
| `ADMIN_INVITE_SECRET` | Secret pour generer des invitations |
| `TRAKT_CLIENT_ID` | Client ID OAuth Trakt |
| `TRAKT_CLIENT_SECRET` | Client Secret OAuth Trakt |
| `LETTERBOXD_CLIENT_ID` | Client ID OAuth Letterboxd |
| `LETTERBOXD_CLIENT_SECRET` | Client Secret OAuth Letterboxd |
| `VIP_JELLYFIN_URL` | URL Jellyfin pour les comptes VIP |
| `VIP_JELLYFIN_API_KEY` | Cle API Jellyfin VIP |
| `VIP_JELLYFIN_SERVER_ID` | ID serveur Jellyfin VIP |
| `RAPIDAPI_KEY` | Cle RapidAPI (streaming availability) |
| `API_SECRET_KEY_NEMO_DOWNLOADER` | Cle API du service de telechargement |

---

## Fichiers Sources

Ce document a ete genere en lisant les fichiers suivants :

- `package.json` -- dependances et versions
- `next.config.ts` -- configuration Next.js (images distantes)
- `src/app/layout.tsx` -- root layout et providers
- `src/app/(main)/layout.tsx` -- layout principal avec Navbar
- `src/app/(auth)/layout.tsx` -- layout authentification
- `src/lib/supabase/server.ts` -- client Supabase server
- `src/lib/supabase/client.ts` -- client Supabase browser
- `src/lib/supabase/admin.ts` -- client Supabase admin
- `src/lib/supabase/middleware.ts` -- middleware session
- `src/lib/auth/session.ts` -- helpers d'authentification
- `src/lib/tmdb/client.ts` -- client TMDB
- `src/lib/stremio/resolver.ts` -- resolver StreamFusion
- `src/lib/jellyfin/client.ts` -- client Jellyfin
- `src/lib/recommendations/scorer.ts` -- algorithme de scoring
- `src/app/api/interactions/route.ts` -- exemple de route handler
