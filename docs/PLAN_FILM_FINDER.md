# Plan — Film Finder (W3NO)

## Objectif

Proposer **le** film idéal à l’utilisateur selon le contexte (seul ou avec des amis), ses goûts (historique, likes), et des critères simples (genre, note min, dispo Jellyfin). Interface minimaliste, centrée, type “finder”.

---

## 1. Entrée utilisateur

### 1.1 Contexte

- **Tu veux un film pour…**
  - **Tout seul** → on utilise uniquement ton historique + likes pour exclure et pondérer.
  - **Avec des potes** → sélecteur multi (amis). On croise les historiques : on ne propose **aucun film** que l’un des X users a déjà vu (progress ≥ 80 %).

### 1.2 Filtres

- **Genre(s)** : multi-select (liste TMDb films).
- **Note minimale** : défaut **7.5/10** (TMDb `vote_average.gte` + `vote_count.gte` pour éviter les films trop peu notés).
- **Disponible sur Jellyfin** (optionnel) : ne proposer que les films présents dans la bibliothèque Jellyfin de l’utilisateur (`jellyfin_server_items` pour son serveur).
- Plus tard (hors scope initial) : studio, réalisateur, etc.

---

## 2. Algorithme de suggestion (sans IA)

1. **Exclusion**  
   Récupérer tous les `tmdb_id` (media_type = movie) avec `progress >= 80` pour :
   - l’utilisateur courant ;
   - chaque ami sélectionné (si “avec des potes”).  
   → Ensemble `excludedIds`.

2. **Découverte TMDb**  
   - `GET /discover/movie` avec :
     - `vote_average.gte` = 7.5 (ou valeur choisie) ;
     - `vote_count.gte` = 300 (éviter les films trop niche) ;
     - `with_genres` si genre(s) choisi(s) ;
     - `sort_by` : `popularity.desc` ou `vote_average.desc` (récent / bien noté).
   - Paginer si besoin (ex. 3–5 pages) pour avoir assez de candidats.

3. **Filtrage côté serveur**  
   - Retirer tous les films dont `id` est dans `excludedIds`.
   - Si “Disponible sur Jellyfin” : garder seulement les films dont `tmdb_id` est dans la liste Jellyfin du user (via `jellyfin_server_items` + `personal_jellyfin_server_id`).

4. **Choix du film**  
   - Pour l’instant : prendre le **premier** du résultat filtré (déjà trié par TMDb).  
   - Évolution possible : pondérer par similarité avec les genres des likes / historique (sans IA).

5. **Réponse**  
   - Retourner 1 film (ou 3–5) avec infos affichables : `id`, `title`, `poster_path`, `vote_average`, `release_date`, etc. + si besoin `jellyfinInLibrary`.

---

## 3. API

- **POST /api/finder/suggest**
  - Body :  
    `{ friendIds?: string[], genreIds?: number[], minRating?: number, onlyJellyfin?: boolean, limit?: number }`
  - Auth : requise (session).
  - Logique :
    - Lire `friendIds` (amis avec qui croiser l’historique).
    - Vérifier que les `friendIds` sont bien des amis (table `friendships`).
    - Construire `excludedIds` (watch_history progress ≥ 80 pour user + friendIds).
    - Optionnel : récupérer les `tmdb_id` Jellyfin du user.
    - Appeler TMDb discover, filtrer par `excludedIds` et éventuellement par Jellyfin.
    - Retourner un ou plusieurs films (résumé TMDb + flag Jellyfin si utile).

---

## 4. Interface (page dédiée)

- **Route** : `/trouve-un-film` (ou `/finder`).
- **Navbar** : bouton visible et stylé (ex. “W3NO” ou icône dédiée) → lien vers cette page.

### 4.1 Maquette fonctionnelle

1. **Titre / accroche**  
   “Tu veux un film pour…?”

2. **Mode**  
   - Boutons ou cards : [ **Tout seul** ] [ **Avec des potes** ].

3. **Si “Avec des potes”**  
   - Multi-select d’amis (liste `useFriends()`).  
   - Affichage des avatars/noms sélectionnés.  
   - Texte du type : “On ne te proposera que des films qu’aucun de vous n’a vus.”

4. **Filtres**  
   - Genre : select ou chips (liste genres films TMDb).  
   - Note min : slider ou select (défaut 7.5).  
   - Case à cocher “Uniquement dans ma bibliothèque Jellyfin” (affichée si user a Jellyfin connecté).

5. **Action**  
   - Bouton “Trouve-moi un film” (ou “W3NO”) → appel `POST /api/finder/suggest` avec les paramètres.

6. **Résultat**  
   - Affichage centré : poster, titre, note, année.  
   - Lien vers la fiche film (`/film/[id]`).  
   - Bouton “Un autre” pour relancer (même critères, autre tirage si on retourne plusieurs candidats ou qu’on exclut le dernier proposé).

### 4.2 Design

- Style “Liquid Glass” cohérent avec le reste de Nemo.
- Interface centrée, minimaliste, peu de bruit visuel.
- Animations légères (motion) pour le passage mode → filtres → résultat.

---

## 5. Données utilisées

| Source              | Usage |
|---------------------|--------|
| `watch_history`     | Exclusion des films déjà vus (progress ≥ 80) pour user + amis. |
| `friendships`       | Vérifier que les `friendIds` sont bien des amis. |
| `interactions`      | (Futur) Pondération par likes. |
| `external_watch_history` | (Futur) Ratings / reviews pour affiner. |
| `jellyfin_server_items` + `profiles.personal_jellyfin_server_id` | Filtre “dispo Jellyfin”. |
| TMDb `discover/movie` | Liste de candidats (genre, note, tri). |

---

## 6. Évolutions possibles

- **Studio / réalisateur** : filtres TMDb `with_companies`, `with_crew`.
- **Pondération par goûts** : utiliser les genres des films likés / bien notés (interactions + external_watch_history) pour scorer les candidats.
- **“Un autre”** : côté API, accepter un paramètre `excludeMovieIds` pour ne pas re-proposer les N derniers films déjà affichés.
- **Sauvegarde** : option “Ajouter à ma liste” depuis le résultat.

---

## 7. Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `src/components/navigation/Navbar.tsx` | Ajouter bouton W3NO → `/trouve-un-film`. |
| `src/app/(main)/trouve-un-film/page.tsx` | Page finder (mode, amis, filtres, résultat). |
| `src/app/api/finder/suggest/route.ts` | API suggestion (exclusion vus, TMDb, Jellyfin). |
| (optionnel) `src/components/finder/FinderForm.tsx` | Formulaire réutilisable. |
| (optionnel) `src/components/finder/FinderResult.tsx` | Carte résultat + “Un autre”. |

Ce plan est conçu pour être **ultra fonctionnel** et livrable par étapes (d’abord seul + genre + 7.5, puis amis, puis Jellyfin).
