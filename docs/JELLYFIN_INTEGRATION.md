# Intégration Jellyfin — NEMO

Ce document décrit comment utiliser Jellyfin comme **authentification**, **source d’historique / listes / favoris** et **source de lecture** dans NEMO, tout en gardant TMDb pour la découverte et les métadonnées.

---

## 1. Utiliser l’authentification Jellyfin

**Oui, c’est possible.**

- **Endpoint** : `POST /Users/AuthenticateByName`  
  Body : `{ "Username": "…", "Pw": "…" }`  
  Réponse : `AuthenticationResult` avec **AccessToken**, **User** (id, name, etc.).

- Le **token** sert pour toutes les requêtes suivantes via le header :  
  `Authorization: MediaBrowser Token="<access_token>", Client="NEMO", Device="Web", DeviceId="…", Version="1.0"`

- **En pratique dans NEMO** :
  - Page **Connexion** : formulaire identifiant / mot de passe → appel à ton serveur Jellyfin `AuthenticateByName` → stockage du token (cookie httpOnly ou session).
  - **Middleware** : sur les routes protégées, vérifier la présence du token Jellyfin (et optionnellement le valider avec un appel type `GET /Users/Me`).
  - **Déconnexion** : supprimer le token / la session côté client et, si tu veux, appeler `POST /Sessions/Logout` sur Jellyfin.

Tu peux soit **remplacer** Supabase Auth par Jellyfin, soit garder Supabase uniquement pour les tables (listes, historique NEMO, etc.) et utiliser Jellyfin uniquement pour “qui est connecté” et pour les données Jellyfin (historique, favoris, présence en bibliothèque). La solution la plus cohérente avec ton objectif est : **auth = Jellyfin**, et soit tu abandonnes les tables Supabase liées au user (listes, historique, interactions), soit tu les gardes en “miroir” ou cache optionnel.

---

## 2. Importer historique, notes, listes depuis Jellyfin

**Oui, avec les limites de l’API Jellyfin.**

### Historique de visionnage

- **Items déjà vus** :  
  `GET /Users/{userId}/Items?Recursive=true&Filters=IsPlayed&SortBy=DatePlayed&SortOrder=Descending&Limit=…`
- Tu peux aussi utiliser **`/Users/{userId}/Items/Resume`** pour les “reprendre”.
- Les items retournés ont des **ProviderIds** (Tmdb, Imdb, etc.) quand la bibliothèque est bien scrapée. Tu peux donc faire la correspondance **TMDB ↔ Jellyfin** via ces IDs.

### Favoris / “Liked”

- **Favoris Jellyfin** :  
  `GET /Users/{userId}/Items?Recursive=true&Filters=IsFavorite&…`
- Pas d’API “like/dislike” comme sur TMDb, mais **Favorite** suffit pour “liké à l’ancienne sur Jellyfin”.

### Listes

- Jellyfin a des **playlists** :  
  `GET /Users/{userId}/Playlists` puis `GET /Playlists/{id}/Items`.
- Les “listes” type “Ma Liste” peuvent être représentées soit par une playlist Jellyfin dédiée, soit par la liste des **Favoris** si tu simplifies.

### Stratégie recommandée

- Au **login** (ou en arrière-plan après connexion) : appels Jellyfin pour récupérer :
  - Items **IsPlayed** (et **DatePlayed**, **PlayCount**) pour l’historique.
  - Items **IsFavorite** pour les favoris.
- Tu **mappes** chaque item Jellyfin vers TMDB via **ProviderIds.Tmdb** (ou Imdb puis recherche TMDB si besoin).
- Dans l’UI NEMO : sur la fiche film/série (TMDb), tu affiches “Déjà vu sur Jellyfin”, “Favori Jellyfin”, “Reprendre” en fonction de ces données. Tu peux **soit** tout dériver à la volée depuis Jellyfin, **soit** synchroniser dans des tables Supabase (ou cache) pour des perfs plus prévisibles.

---

## 3. Savoir si un film/série est sur le Jellyfin (et avec quels détails)

**Oui, en passant par les IDs externes.**

- L’API Jellyfin **ne permet pas** de faire une requête du type “donne-moi l’item dont le TMDB id = 12345”. Il faut soit parcourir des items, soit les indexer.
- **Approche recommandée** :
  1. **Cache / index côté NEMO** :  
     - Lors de la synchro (ou d’un job), récupérer les items de la bibliothèque (films/séries) :  
       `GET /Users/{userId}/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,MediaSources,…`
     - Pour chaque item, lire **ProviderIds** (Tmdb, Imdb). Construire une map **tmdbId → item Jellyfin** (id, qualité, chemins, MediaSources, etc.).
  2. **À l’affichage d’une fiche TMDb** (ex. film 12345) :  
     - Lookup dans cette map : si `tmdbId === 12345` → “Disponible sur Jellyfin” + infos (qualité, taille, codec si tu les exposes).
  3. **Rafraîchissement** : périodique ou “rafraîchir la bibliothèque” depuis l’UI, puis re-sync des items.

Alternative plus lourde : pour chaque fiche consultée, appeler Jellyfin “tous les films” et filtrer côté client par TmdbId — faisable pour une petite bibliothèque, pas pour des milliers d’items.

---

## 4. Lecture : lien Jellyfin ou lecture dans NEMO

**Deux options.**

### A. Redirection vers le lecteur Jellyfin

- Tu construis une URL vers ton serveur Jellyfin, par exemple :  
  `https://ton-jellyfin.example.com/web/index.html#!/itemdetails.html?id={itemId}&serverId=…`  
  ou le lien “play” officiel (selon la version de Jellyfin).
- Avantage : pas de gestion du stream dans NEMO, tout le transcodage / direct play est géré par Jellyfin.

### B. Lecture dans le navigateur (NEMO)

- Récupérer l’URL de stream pour l’item :  
  - **MediaInfoApi** : `getPostedPlaybackInfo(itemId, …)` → dans la réponse tu obtiens les **MediaSources** et les URLs de stream (HLS ou direct).
- Ensuite, soit tu rediriges vers une URL HLS (nouvel onglet), soit tu intégres un lecteur **HLS.js** (déjà dans ton stack) dans NEMO et tu passes l’URL du manifest HLS. Il faudra transmettre le **token** Jellyfin (en query param ou header) selon la config de ton serveur.

Tu peux proposer les deux : bouton “Ouvrir dans Jellyfin” (redirection) et “Lire ici” (lecteur intégré HLS).

---

## 5. Résumé des flux

| Besoin | Source | Comment |
|--------|--------|--------|
| Qui est connecté | Jellyfin | `AuthenticateByName` → stocker token ; protéger routes avec token |
| Historique de visionnage | Jellyfin | `Users/{id}/Items?Filters=IsPlayed` + ProviderIds → map TMDB |
| Favoris / “liké” | Jellyfin | `Users/{id}/Items?Filters=IsFavorite` |
| Listes | Jellyfin | Playlists ou Favoris |
| “Ce film est-il sur Jellyfin ?” | Cache NEMO | Sync bibliothèque → map tmdbId → item Jellyfin |
| Lire le film | Jellyfin | Redirection vers client Jellyfin **ou** PlaybackInfo → URL HLS → lecteur NEMO |

---

## 6. Plan d’implémentation proposé

1. **Env / config**  
   - `NEXT_PUBLIC_JELLYFIN_URL` (ex. `https://jellyfin.example.com`)  
   - Pas de clé API globale nécessaire pour l’auth user ; optionnellement une clé API Jellyfin pour des appels serveur si tu veux limiter l’exposition du token.

2. **Client API Jellyfin**  
   - Module (ex. `src/lib/jellyfin/client.ts`) :  
     - `authenticateByName(username, pw)`  
     - `getCurrentUser()` (avec token)  
     - `getUserLibraryItems(userId, filters)`  
     - `getPlayedItems(userId)`, `getFavoriteItems(userId)`  
     - `getItemByProviderId(userId, tmdbId)` ou utiliser un cache d’items indexé par TmdbId  
     - `getPlaybackInfo(itemId)` pour l’URL de lecture

3. **Auth**  
   - Remplacer (ou doubler) la page de connexion : formulaire → `authenticateByName` → stocker le token (cookie httpOnly via Route Handler ou Server Action).  
   - Middleware : lire le cookie token ; si route protégée et pas de token → redirect login.  
   - Hook `useAuth()` : exposer `user` (profil Jellyfin) et `signOut` ; le user peut venir d’un endpoint qui lit le cookie et appelle `getCurrentUser()`.

4. **Sync Jellyfin → affichage NEMO**  
   - Après login : charger “played” et “favorites”, les mapper en tmdbId.  
   - Soit tout en client (hooks), soit Route Handler qui appelle Jellyfin avec le token cookie et renvoie les listes.  
   - Afficher sur les cartes/fiches : “Vu sur Jellyfin”, “Favori”, “Reprendre” selon ces données.

5. **Bibliothèque et “disponible sur Jellyfin”**  
   - Job ou endpoint qui récupère les items de la bibliothèque (films/séries) et construit une map `tmdbId → { itemId, title, quality?, … }`.  
   - Stockage : en mémoire (cache serveur), Redis, ou table Supabase selon la taille.  
   - Sur la fiche film/série : si présent dans la map → badge “Sur Jellyfin” + détails + bouton lecture.

6. **Lecture**  
   - Si “Lire ici” : appeler `getPlaybackInfo(jellyfinItemId)` → récupérer l’URL HLS → la passer à ton `VideoPlayer` (HLS.js) avec le token si nécessaire.  
   - Si “Ouvrir dans Jellyfin” : redirection vers l’URL du client web Jellyfin avec l’item.

7. **Optionnel**  
   - Garder Supabase pour des données purement NEMO (ex. commentaires, listes custom hors Jellyfin) en liant à un `jellyfin_user_id` au lieu de `auth.uid()`.

---

## 7. Variables d’environnement suggérées

```env
# Jellyfin
NEXT_PUBLIC_JELLYFIN_URL=https://ton-serveur-jellyfin.com
# Optionnel : pour des appels serveur sans token user
JELLYFIN_API_KEY=
```

Le token utilisateur sera stocké côté client (cookie) après login ; les appels depuis le serveur (Route Handlers, Server Actions) pourront lire ce cookie et l’envoyer à Jellyfin.

---

Tu peux commencer par le **client Jellyfin + auth** (connexion avec Jellyfin, stockage du token, `useAuth()` basé sur Jellyfin), puis enchaîner sur la synchro played/favorites et l’affichage “sur Jellyfin” + lecture.

---

## 8. Ce qui a été ajouté dans le projet

- **`src/types/jellyfin.ts`** — Types pour l’API Jellyfin (auth, items, playback).
- **`src/lib/jellyfin/client.ts`** — Client : `authenticateByName`, `getCurrentUser`, `getPlayedItems`, `getFavoriteItems`, `getResumeItems`, `getLibraryItems`, `getPlaybackInfo`, `isJellyfinConfigured`.
- **`src/app/api/auth/jellyfin/route.ts`** — POST login (body : `username`, `password`) → cookie `jellyfin_token`.
- **`src/app/api/auth/me/route.ts`** — GET → retourne `{ user: { id, name } }` si token valide.
- **`src/app/api/auth/logout/route.ts`** — POST → supprime le cookie.
- **`src/hooks/use-jellyfin-auth.ts`** — Hook : `user`, `loading`, `signIn(username, password)`, `signOut()`, `refetch()`.

### Activer la connexion Jellyfin

1. **Variables d’environnement** (ex. `.env.local`) :
   ```env
   NEXT_PUBLIC_JELLYFIN_URL=https://ton-serveur-jellyfin.com
   ```
   (sans slash final)

2. **Page de connexion** : pour utiliser Jellyfin au lieu de Supabase, appelle `signIn(username, password)` du hook `useJellyfinAuth()` et envoie le formulaire vers `/api/auth/jellyfin` (déjà fait si tu utilises `useJellyfinAuth().signIn`). Tu peux garder le même formulaire en renommant “Adresse e-mail” en “Identifiant Jellyfin” (Jellyfin utilise un username, pas forcément un email).

3. **Middleware** : pour protéger les routes avec la session Jellyfin, dans `updateSession` (ou équivalent), vérifier la présence du cookie `jellyfin_token` pour les chemins protégés et rediriger vers `/connexion` si absent (quand tu auras basculé à 100 % sur Jellyfin).

4. **Navbar / profil** : `useAuth()` lit désormais la session Jellyfin via `/api/auth/me` ; le profil (nom, préférences) est stocké dans Supabase dans la table `jellyfin_users`, identifié par l’ID utilisateur Jellyfin.

### Clé API Jellyfin (optionnelle)

Une **clé API** peut être créée dans le tableau de bord Jellyfin (Admin → API Keys). Elle est utile pour des appels serveur sans session utilisateur (ex. cache bibliothèque, tâches planifiées). Définir dans `.env.local` :

```env
JELLYFIN_API_KEY=ta_cle_generee
```

Le client utilise le token utilisateur (cookie) pour tout ce qui est lié à la session ; la clé API peut être utilisée en fallback ou pour des endpoints qui l’acceptent.
