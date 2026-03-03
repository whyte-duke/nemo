# 🌊 Nemo — Plateforme de streaming

Plateforme de streaming de classe mondiale propulsée par **TMDb**, **Stremio/AllDebrid** et **Supabase**.

## ✨ Fonctionnalités

- 🎬 **Catalogue TMDb complet** — Films, séries, acteurs avec données riches (France)
- 🎯 **Hubs par provider** — Netflix, Apple TV+, Canal+, Disney+, Amazon...
- ⚡ **Résolution de flux via StreamFusion** — Encodage Base64, parsing regex des qualités
- 🗄️ **Backend Supabase** — Auth, historique, listes, interactions like/dislike
- 🎥 **Lecteur Plyr + HLS** — Qualité native, sous-titres, mode PiP
- 🔍 **Recherche multi** — Films, séries, acteurs en temps réel
- 🌙 **Design Liquid Glass** — Thème ultra-sombre avec backdrop-blur premium

## 🚀 Installation

```bash
pnpm install
```

## ⚙️ Configuration

Copiez `.env.local` et remplissez vos clés :

```env
# TMDb API — https://www.themoviedb.org/settings/api
NEXT_PUBLIC_TMDB_API_KEY=votre_cle_api_tmdb

# Supabase — https://app.supabase.com
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SUPABASE_SERVICE_ROLE_KEY=votre_service_role

# StreamFusion (optionnel, déjà configuré)
NEXT_PUBLIC_STREAMFUSION_BASE=https://stream-fusion.stremiofr.com
```

## 🗄️ Base de données Supabase

Exécutez la migration SQL dans l'éditeur SQL de votre projet Supabase :

```
supabase/migrations/001_initial_schema.sql
```

## 🏃 Développement

```bash
pnpm dev
```

Ouvrez [http://localhost:3000](http://localhost:3000)

## 🏗️ Build de production

```bash
pnpm build
pnpm start
```

## 🗂️ Structure du projet

```
src/
├── app/                    # App Router Next.js 16
│   ├── (auth)/             # Pages connexion/inscription
│   │   ├── connexion/
│   │   └── inscription/
│   └── (main)/             # Pages avec navbar
│       ├── film/[id]/      # Fiche film
│       ├── serie/[id]/     # Fiche série
│       ├── acteur/[id]/    # Page acteur
│       ├── hub/[provider]/ # Hub Netflix, Apple TV+, etc.
│       ├── recherche/      # Recherche multi
│       ├── ma-liste/       # Liste personnalisée
│       ├── historique/     # Historique de visionnage
│       └── profil/         # Profil + paramètres
├── components/
│   ├── hero/               # HeroCinematic (banner principal)
│   ├── media/              # MediaCard, MediaRow, DetailModal
│   ├── player/             # VideoPlayer, StreamModal
│   ├── navigation/         # Navbar avec recherche live
│   ├── hub/                # HubContent (pages providers)
│   ├── home/               # HomeContent
│   └── search/             # SearchContent
├── hooks/                  # Hooks TanStack Query
├── lib/
│   ├── tmdb/               # Client TMDb API
│   ├── stremio/            # Moteur de résolution flux
│   └── supabase/           # Client browser/server
├── providers/              # QueryProvider, StreamProvider
└── types/                  # Types TMDb, Stremio, Supabase
```

## 🎬 Architecture Streaming

```
Utilisateur clique "Lecture"
    ↓
Récupération imdb_id via TMDb
    ↓
Encodage de la config AllDebrid en Base64
    ↓
GET https://stream-fusion.stremiofr.com/{BASE64}/stream/movie/{IMDB_ID}.json
    ↓
Parsing regex des flux (qualité, taille, langue, codec)
    ↓
Modale de sélection des flux triés
    ↓
Lecteur Plyr (HLS ou HTTP direct)
```

## 🔑 Providers supportés

| Provider | TMDb ID | URL Hub |
|---|---|---|
| Netflix | 8 | /hub/netflix |
| Apple TV+ | 350 | /hub/apple-tv |
| Canal+ | 381 | /hub/canal-plus |
| Disney+ | 337 | /hub/disney-plus |
| Amazon Prime | 119 | /hub/amazon |
| OCS | 56 | /hub/ocs |
| Paramount+ | 531 | /hub/paramount |
| Max | 1899 | /hub/max |
