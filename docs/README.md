# Nemo -- Documentation Technique

> Derniere mise a jour : 2026-03-04 | Audience : Agents IA (Claude) + Developpeurs

## Resume du Projet

Nemo est une plateforme de streaming social construite avec Next.js 16 et Supabase. Elle permet de decouvrir des films et series via un systeme de recommandation personnalise en 5 phases, de gerer des listes collaboratives entre amis, et de regarder du contenu via Jellyfin ou StreamFusion/Stremio. L'application integre un graphe social, un import depuis Letterboxd/Trakt/Netflix, et une file de telechargement via Debrid. Interface en francais, mobile-first, animee avec Framer Motion.

## Stack Technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.1.6 | Framework React, App Router, routes API |
| React | 19.2.3 | Server Components + Client Components |
| Supabase JS | 2.98.0 | PostgreSQL, Auth, RLS |
| Supabase SSR | 0.8.0 | Client serveur et middleware |
| TanStack Query | 5.90.21 | Cache client, mutations |
| Motion (Framer) | 12.34.3 | Animations |
| Tailwind CSS | 4.x | Styling utilitaire |
| Radix UI | Multiple | Composants accessibles (Dialog, Tabs, Dropdown) |
| hls.js | 1.6.15 | Lecture video HLS |
| Plyr | 3.8.4 | Lecteur video |
| TypeScript | 5.x | Typage statique |

## Architecture Rapide

```
src/
  app/
    (auth)/             -- Connexion, inscription (2 pages)
    (main)/             -- 17 pages : films, series, decouvrir, amis, listes, profil...
    api/                -- 57 routes API
    onboarding/         -- Onboarding nouvel utilisateur
  components/           -- 18 sous-dossiers, 40+ composants
  hooks/                -- 13 hooks personnalises
  contexts/             -- Contexte Jellyfin library
  lib/
    auth/               -- Session Supabase + Jellyfin
    jellyfin/           -- Client et sync Jellyfin
    recommendations/    -- Scorer, taste-profile, contextes
    stremio/            -- Resolver StreamFusion
    supabase/           -- Clients (browser, server, admin), middleware
    tmdb/               -- Client TMDB, genres, features
supabase/
  migrations/           -- 13 migrations, 17+ tables
```

## Index de la Documentation

### Architecture

- [Vue d'ensemble](./architecture/overview.md) -- Architecture globale, flux de donnees, patterns
- [Base de donnees](./architecture/database.md) -- 17+ tables, colonnes, RLS, triggers, migrations
- [Routes API](./architecture/api-routes.md) -- 57 endpoints documentes
- [Authentification](./architecture/authentication.md) -- Supabase Auth, roles, invitations

### Fonctionnalites

- [Recommandations](./features/recommendations.md) -- Algorithme 5 phases, poids, scorer
- [Listes collaboratives](./features/lists.md) -- Multi-listes, membres, partage, RLS
- [Graphe social](./features/social.md) -- Amis, demandes, auto-friending
- [Streaming](./features/streaming.md) -- StreamFusion, Stremio, HLS, lecteur video
- [Jellyfin](./features/jellyfin.md) -- Integration serveur, sync bibliotheque
- [Telechargements](./features/downloads.md) -- File d'attente, Debrid, batch

### Composants

- [Hooks](./components/hooks.md) -- 13 hooks : auth, listes, amis, TMDB, streaming, swipe
- [Contextes](./components/contexts.md) -- Recommendations, interactions, Jellyfin library
- [Composants UI](./components/ui-components.md) -- Navigation, hero, media, player, search

### Integrations

- [TMDB](./integrations/tmdb.md) -- Client, cache, genres, features media
- [Supabase](./integrations/supabase.md) -- Clients, middleware, helpers RLS
- [Services externes](./integrations/external-services.md) -- Stremio, Debrid, OAuth, imports

## Quick Reference

### Tables (17+)

`profiles` | `watch_history` | `lists` | `list_items` | `list_members` | `interactions` | `download_queue` | `jellyfin_servers` | `jellyfin_server_items` | `jellyfin_users` | `jellyfin_library` | `external_watch_history` | `invite_tokens` | `invite_uses` | `friendships` | `friend_requests` | `streaming_preferences`

### Routes API critiques

`GET /api/auth/me` | `GET /api/recommendations` | `GET/POST /api/lists` | `GET/POST /api/interactions` | `GET /api/discover/cards` | `GET /api/streaming/[imdbId]` | `POST /api/download/start` | `GET /api/jellyfin/user/stream/[itemId]` | `GET /api/taste-profile` | `GET/POST /api/friends`

### Hooks (13)

`use-auth` | `use-tmdb` | `use-list` | `use-lists` | `use-friends` | `use-downloads` | `use-streaming-availability` | `use-streaming-preferences` | `use-jellyfin-auth` | `use-jellyfin-library` | `use-watch-history` | `use-profile` | `use-swipe-session`

## Commandes

```bash
pnpm dev       # Serveur de developpement
pnpm build     # Build production
pnpm lint      # Linter ESLint
```

## Fichiers Sources

- `package.json` -- versions des dependances
- `src/app/` -- routes (pages et API)
- `src/lib/` -- auth, jellyfin, recommendations, stremio, supabase, tmdb
- `src/hooks/` -- 13 hooks
- `src/components/` -- 18 sous-dossiers
- `src/contexts/` -- contextes React
- `supabase/migrations/` -- 13 migrations SQL
