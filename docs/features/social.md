# Fonctionnalite sociale -- Amis & Activite

> Migration : `supabase/migrations/012_friendships.sql`
> Page principale : `src/app/(main)/amis/page.tsx`

---

## 1. Vue d'ensemble

Nemo dispose d'un **graphe d'amitie bidirectionnel** : si A est ami de B, alors B est ami de A. Ce graphe est materialise dans une seule table `friendships` avec une contrainte d'unicite orientee (`user_id < friend_id`), ce qui garantit qu'il n'existe jamais deux lignes pour la meme paire.

Le graphe social alimente trois fonctionnalites :

| Fonctionnalite | Description |
|----------------|-------------|
| **Liste d'amis** | Grille de cartes navigables vers les profils |
| **Fil d'activite** | Flux pagine des actions recentes des amis (visionnages, likes, ajouts aux listes) |
| **Score social** | Les recommandations intègrent les likes des amis via `scoreItem()` dans le moteur de recommandation |

---

## 2. Modele de donnees

### 2.1 Table `friendships`

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Identifiant unique |
| `user_id` | UUID FK profiles | Le plus petit UUID de la paire |
| `friend_id` | UUID FK profiles | Le plus grand UUID de la paire |
| `source` | TEXT (`invite` \| `manual`) | Origine de l'amitie |
| `created_at` | TIMESTAMPTZ | Date de creation |

**Contrainte `CHECK (user_id < friend_id)`** : pour toute paire (A, B), seule la ligne ou `user_id` est le plus petit UUID est stockee. La fonction helper `insert_friendship(a, b, src)` trie les UUID avant insertion avec `ON CONFLICT DO NOTHING`.

Index sur `user_id` et `friend_id` pour les lookups bidirectionnels.

### 2.2 Table `friend_requests`

```sql
CREATE TABLE friend_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user <> to_user),
  UNIQUE(from_user, to_user)
);
```

La contrainte `UNIQUE(from_user, to_user)` empeche les demandes en double. Le code d'erreur `23505` (violation d'unicite) est intercepte cote API pour renvoyer un message explicite.

**Index** : `idx_friend_requests_to(to_user, status)` pour charger rapidement les demandes recues en attente, `idx_friend_requests_from(from_user)` pour les demandes envoyees.

---

## 3. Sources d'amitie

### 3.1 Par invitation (automatique, profondeur 2)

Lorsqu'un utilisateur rejoint Nemo via un token d'invitation, le trigger `trg_auto_friendship` (sur la table `invite_uses`) execute la fonction `auto_friendship_on_invite()` :

1. **Profondeur 1** : l'inviteur et le nouvel invitee deviennent amis.
2. **Profondeur 2** : tous les amis existants de l'inviteur deviennent egalement amis avec le nouvel invitee.

```
auto_friendship_on_invite()
  |
  |-- Recupere inviter_id depuis invite_tokens.created_by
  |-- insert_friendship(inviter_id, new_user, 'invite')      -- profondeur 1
  |-- POUR CHAQUE ami existant de inviter_id :
  |     insert_friendship(existing_friend, new_user, 'invite') -- profondeur 2
```

Cas particulier : si le token a ete cree par un admin (`created_by IS NULL`), aucune amitie automatique n'est creee.

### 3.2 Par demande manuelle

Un utilisateur peut envoyer une demande d'ami depuis la page `/amis` ou depuis un profil. L'acceptation declenche le trigger `trg_accept_request` qui appelle `friendship_on_accept()` et insere une entree `friendships` avec `source = 'manual'`.

---

## 4. Auto-amitie de profondeur 2

Le mecanisme de profondeur 2 construit un reseau social etendu automatiquement. Voici un exemple concret :

```
Etat initial :
  Alice --ami-- Bob
  Alice --ami-- Claire

Eve rejoint via un token d'invitation cree par Alice.

Apres le trigger :
  Alice --ami-- Eve    (profondeur 1 : inviteur direct)
  Bob   --ami-- Eve    (profondeur 2 : ami d'Alice)
  Claire --ami-- Eve   (profondeur 2 : ami d'Alice)
```

**Pourquoi profondeur 2 ?** L'hypothese est que les amis d'un inviteur partagent des gouts cinematographiques proches. Cela bootstrap le graphe social pour que le fil d'activite et les recommandations sociales soient utiles des l'inscription.

La fonction `insert_friendship()` utilise `ON CONFLICT DO NOTHING`, donc si Bob et Eve etaient deja amis par un autre chemin, aucun doublon n'est cree.

---

## 5. Flux des demandes d'ami

### Etats possibles

```
pending  -->  accepted  -->  [friendship creee via trigger]
         -->  declined  -->  [rien ne se passe]
```

### Deroulement complet

1. **L'expediteur** cherche un utilisateur via la barre de recherche (`/api/friends/search`).
2. **L'expediteur** clique "Ajouter" -- `POST /api/friends/request` cree une entree `friend_requests` avec `status = 'pending'`.
3. **Le destinataire** voit la demande dans la section "Demandes recues" de `/amis` (poll toutes les 60 secondes via `refetchInterval`).
4. **Le destinataire** accepte ou decline -- `PATCH /api/friends/request/[id]` met a jour le `status`.
5. Si **accepte** : le trigger `trg_accept_request` appelle `insert_friendship(from_user, to_user, 'manual')`.
6. Les deux caches React Query (`friends` et `friend-requests`) sont invalides cote client.

### Annulation

L'expediteur peut annuler sa demande via `DELETE /api/friends/request/[id]` (verifie que `from_user` correspond a l'utilisateur connecte).

---

## 6. Regles de visibilite (RLS)

La migration 012 configure des policies Row Level Security pour determiner ce que les amis peuvent voir :

Le pattern RLS commun pour les donnees sociales verifie l'existence d'une entree dans `friendships` :

```sql
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM friendships f
    WHERE (f.user_id = auth.uid() AND f.friend_id = <table>.user_id)
       OR (f.friend_id = auth.uid() AND f.user_id = <table>.user_id)
  )
)
```

Ce pattern est applique a `watch_history`, `interactions`, et `lists` (avec en plus `is_public` et `list_members`). Les `list_items` heritent de la visibilite de leur liste parente.

### Resume

| Donnee | Proprietaire | Ami | Utilisateur quelconque |
|--------|-------------|-----|----------------------|
| Profil (champs publics) | Oui | Oui | Oui |
| Profil (champs sensibles) | Oui | Non | Non |
| Historique de visionnage | Oui | Oui | Non |
| Interactions (likes) | Oui | Oui | Non |
| Listes privees | Oui | Oui | Non |
| Listes publiques | Oui | Oui | Oui |

---

## 7. Routes API

Toutes les routes necessitent une authentification. Elles utilisent `getAuthUser()` et renvoient `401` si absent.

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/friends` | `GET` | Liste des amis avec profil, source, date, films vus. Reponse : `FriendProfile[]` |
| `/api/friends/search?q=<terme>` | `GET` | Recherche par `display_name` (ILIKE, min 2 car., max 10). Inclut `is_friend` et `request_pending` |
| `/api/friends/request` | `GET` | Demandes recues en attente avec profil de l'expediteur |
| `/api/friends/request` | `POST` | Envoyer une demande. Body : `{ toUserId }`. Verifie doublon amitie et demande existante |
| `/api/friends/request/[id]` | `PATCH` | Accepter/decliner. Body : `{ status: "accepted" \| "declined" }`. Seul le destinataire |
| `/api/friends/request/[id]` | `DELETE` | Annuler sa propre demande. Seul l'expediteur |
| `/api/friends/[userId]/profile` | `GET` | Profil avec metadonnees de relation (`is_friend`, `friends_since`, `request_pending`, etc.) |
| `/api/friends/[userId]/stats` | `GET` | Stats : `total_watched`, `total_likes`, `total_dislikes`, `total_lists`, `top_genres`, `recent_watched` |
| `/api/friends/[userId]/history` | `GET` | 50 derniers visionnages (progress >= 80%), enrichis TMDB |
| `/api/friends/[userId]/likes` | `GET` | 50 derniers likes, enrichis TMDB |
| `/api/friends/[userId]/lists` | `GET` | Listes avec `name`, `icon`, `is_public`, `item_count` |
| `/api/activity` | `GET` | Fil d'activite agrege. Params : `?type=watched\|liked\|added_to_list`, `?cursor=<ISO date>` |

---

## 8. Fil d'activite

Le endpoint `/api/activity` agregue trois sources de donnees pour construire un flux chronologique :

### Sources agregees

| Source | Table | Condition | Type d'evenement |
|--------|-------|-----------|------------------|
| Visionnages | `watch_history` | `progress >= 80%` | `watched` |
| Interactions | `interactions` | `type = 'like'` ou `'dislike'` | `liked` / `disliked` |
| Ajouts aux listes | `list_items` (join `lists`) | Proprietaire est un ami | `added_to_list` |

Chaque evenement (`ActivityEvent` dans `src/types/supabase.ts`) contient le profil de l'ami, les metadonnees du media (enrichies TMDB), et optionnellement les infos de la liste.

### Pagination par curseur

- Le parametre `cursor` est un timestamp ISO. Chaque source filtre avec `< cursor`, LIMIT 30.
- Les trois sources sont fusionnees, triees par `timestamp` decroissant, tronquees a 30.
- Les metadonnees TMDB sont resolues en parallele via `Promise.allSettled` avec un cache local.

---

## 9. Frontend

### 9.1 Page `/amis` (`src/app/(main)/amis/page.tsx`)

Page client (`"use client"`) structuree en trois sections :

#### Section 1 : Demandes recues

Visible uniquement s'il y a des demandes en attente. Affiche un badge rouge avec le compteur. Chaque demande montre l'avatar, le nom, et deux boutons (Accepter / Decliner).

#### Section 2 : Recherche d'amis

Champ de recherche avec debounce de 400ms (`useDebouncedSearch`). Les resultats affichent le statut de relation :
- **Deja ami** : badge "Ami" avec icone
- **Demande envoyee** : texte "Demande envoyee"
- **Aucune relation** : bouton "Ajouter"

Un ensemble local `sentRequests` (Set) donne un feedback instantane apres l'envoi d'une demande, sans attendre la revalidation du cache.

#### Section 3 : Grille des amis

Grille responsive (`grid-cols-2` a `grid-cols-5` selon la taille d'ecran). Chaque ami est rendu par le composant `FriendCard`.

#### Bouton d'invitation

Visible uniquement pour les roles `sources`, `vip`, et `admin`. Ouvre le composant `InviteModal` pour generer des tokens d'invitation.

### 9.2 Composant `FriendCard` (`src/components/friends/FriendCard.tsx`)

Carte cliquable (lien vers `/profil/[id]`) affichant :
- Avatar (image ou initiale)
- Nom d'affichage
- Badge de role (ADMIN, VIP, SOURCES) avec code couleur
- Nombre de films vus
- CTA "Voir le profil"

### 9.3 Composant `ActivityFeed` (`src/components/activity/ActivityFeed.tsx`)

Flux d'activite groupe par jour ("Aujourd'hui", "Hier", ou date FR). Chaque evenement affiche l'avatar de l'ami, une description localisee, le temps relatif, et un apercu du media (poster miniature). Scroll infini via `IntersectionObserver` + `useInfiniteQuery`.

### 9.4 Hooks (`src/hooks/use-friends.ts`)

| Hook | Query Key | Description |
|------|-----------|-------------|
| `useFriends()` | `["friends", userId]` | Liste des amis, staleTime 5 min |
| `useFriendRequests()` | `["friend-requests", userId]` | Demandes recues, staleTime 30s, refetch toutes les 60s |
| `useSendFriendRequest()` | Mutation | Envoie une demande, invalide `friend-requests` |
| `useRespondFriendRequest()` | Mutation | Accepte/decline, invalide `friends` et `friend-requests` |
| `useSearchUsers(query)` | `["users-search", query]` | Recherche, active si query >= 2 caracteres, staleTime 30s |
| `useFriendProfile(userId)` | `["friend-profile", userId]` | Profil complet avec metadonnees de relation |
| `useFriendStats(userId)` | `["friend-stats", userId]` | Statistiques d'un ami |
| `useFriendActivity(type?)` | `["friend-activity", userId, type]` | Fil d'activite pagine via `useInfiniteQuery` |

### 9.5 Onboarding (`src/components/onboarding/StepInviteFriends.tsx`)

Etape d'onboarding qui encourage les nouveaux utilisateurs a inviter leurs amis. Presente les fonctionnalites sociales (streaming gratuit, listes partagees, activite, avis, historique) dans une grille animee, avec un bouton d'invitation prominent.

---

## 10. Integration avec les recommandations

Le moteur de recommandation (`src/lib/recommendations/scorer.ts`) integre un **score social** dans le calcul de pertinence :

```
score_final = 0.30 * trending + 0.20 * taste + 0.20 * social + 0.05 * quality
```

Le score social est calcule comme la fraction d'amis ayant like un contenu, normalisee par le nombre total d'amis (minimum 3 pour eviter les petits denominateurs) :

```typescript
socialScore = Math.min(likeCount / Math.max(friendCount, 3), 1.0)
```

Lorsque `socialScore > 0.4`, la raison de recommandation affichee est `"social"` avec le nombre d'amis ayant like.
