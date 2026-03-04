# Listes multi-collaboratives

## Vue d'ensemble

Le systeme de listes de Nemo permet a chaque utilisateur de gerer plusieurs listes de films et series. Chaque utilisateur dispose automatiquement d'une liste par defaut nommee **"Ma Liste"** (creee a la demande lors du premier ajout) ainsi que d'une liste systeme **"Suggestions"** (non supprimable). Au-dela de ces listes automatiques, l'utilisateur peut creer un nombre illimite de listes personnalisees, chacune identifiee par un nom (max 30 caracteres) et une icone emoji.

Les listes supportent la collaboration : le createur (owner) peut inviter ses amis comme membres. Tous les membres -- owner et members -- peuvent librement ajouter et retirer des medias de la liste, sans validation prealable. Cela permet de construire des listes de visionnage partagees entre amis.

### Fonctionnalites cles

- **Liste par defaut "Ma Liste"** : creee automatiquement, marquee `is_default = true`, non supprimable
- **Liste "Suggestions"** : creee automatiquement, marquee `non_deletable = true`, publique par defaut
- **Listes personnalisees** : creation illimitee avec nom, icone emoji et membres optionnels
- **Collaboration** : ajout d'amis comme membres lors de la creation ou apres
- **Visibilite** : chaque liste peut etre publique ou privee
- **Enrichissement TMDB** : les items sont enrichis avec titre, poster et metadonnees depuis l'API TMDB

---

## Modele de donnees

### Table `lists`

Table principale stockant les metadonnees de chaque liste.

| Colonne | Type | Defaut | Description |
|---------|------|--------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Identifiant unique |
| `user_id` | `UUID` | -- | Reference vers `profiles(id)`, createur de la liste |
| `name` | `TEXT` | -- | Nom de la liste (max 30 caracteres cote application) |
| `description` | `TEXT` | `NULL` | Description optionnelle |
| `icon` | `TEXT` | `NULL` | Icone emoji (ex: "🎬", "🍿", "⭐") |
| `is_default` | `BOOLEAN` | `false` | `true` pour la liste "Ma Liste" de chaque utilisateur |
| `is_public` | `BOOLEAN` | `false` | Visibilite publique de la liste |
| `non_deletable` | `BOOLEAN` | -- | Empeche la suppression (utilise pour la liste "Suggestions") |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | Date de creation |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | Derniere modification (trigger automatique) |

**Indexes :**
- `idx_lists_user_id` sur `user_id`

**Triggers :**
- `trg_lists_updated_at` : met a jour `updated_at` automatiquement via `update_updated_at_column()`
- `trg_list_owner` : insere automatiquement le createur comme `owner` dans `list_members` apres chaque `INSERT`

### Table `list_items`

Stocke les medias (films et series) ajoutes a chaque liste. Un meme media ne peut apparaitre qu'une fois par liste grace a la contrainte d'unicite.

| Colonne | Type | Defaut | Description |
|---------|------|--------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Identifiant unique |
| `list_id` | `UUID` | -- | Reference vers `lists(id)` (CASCADE a la suppression) |
| `tmdb_id` | `INTEGER` | -- | Identifiant TMDB du film ou de la serie |
| `media_type` | `TEXT` | -- | Type de media : `'movie'` ou `'tv'` |
| `sort_order` | `INTEGER` | `0` | Ordre de tri personnalise |
| `added_at` | `TIMESTAMPTZ` | `NOW()` | Date d'ajout a la liste |

**Contraintes :**
- `UNIQUE (list_id, tmdb_id, media_type)` -- un media ne peut etre present qu'une fois par liste
- `CHECK (media_type IN ('movie', 'tv'))` -- types valides

**Indexes :**
- `idx_list_items_list_id` sur `list_id`

### Table `list_members`

Table pivot gerant l'appartenance des utilisateurs aux listes et leurs roles.

| Colonne | Type | Defaut | Description |
|---------|------|--------|-------------|
| `id` | `UUID` | `gen_random_uuid()` | Identifiant unique |
| `list_id` | `UUID` | -- | Reference vers `lists(id)` (CASCADE) |
| `user_id` | `UUID` | -- | Reference vers `profiles(id)` (CASCADE) |
| `role` | `TEXT` | `'member'` | Role : `'owner'` ou `'member'` |
| `joined_at` | `TIMESTAMPTZ` | `NOW()` | Date d'adhesion |

**Contraintes :**
- `UNIQUE (list_id, user_id)` -- un utilisateur ne peut etre membre qu'une fois par liste
- `CHECK (role IN ('owner', 'member'))` -- roles valides

**Indexes :**
- `idx_list_members_user_id` sur `user_id`
- `idx_list_members_list_id` sur `list_id`

### Trigger `add_list_owner()`

Fonction declenchee apres chaque `INSERT` sur `lists`. Elle insere automatiquement le `user_id` du createur dans `list_members` avec le role `'owner'`. Utilise `ON CONFLICT DO NOTHING` pour l'idempotence.

```sql
CREATE OR REPLACE FUNCTION add_list_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO list_members (list_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Systeme de roles

### Owner (proprietaire)

Le createur de la liste. Insere automatiquement via le trigger `trg_list_owner`.

**Permissions :**
- Voir la liste et ses items
- Ajouter et retirer des items
- Modifier la liste (nom, icone, visibilite)
- Supprimer la liste (sauf `is_default` et `non_deletable`)
- Ajouter des membres (uniquement des amis)
- Retirer des membres

### Member (membre)

Un ami invite par l'owner.

**Permissions :**
- Voir la liste et ses items
- Ajouter et retirer des items
- Se retirer soi-meme de la liste

**Restrictions :**
- Ne peut pas modifier les metadonnees de la liste (nom, icone, visibilite)
- Ne peut pas supprimer la liste
- Ne peut pas ajouter ni retirer d'autres membres

---

## Politiques RLS (Row Level Security)

Toutes les tables ont RLS active. Les routes API utilisent un client admin (`createRawAdminClient`) qui contourne RLS, mais les policies restent en place pour la securite en profondeur.

### Policies sur `lists`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `lists_select_member_or_public` | `SELECT` | `is_public = TRUE` OU l'utilisateur est membre via `list_members` |
| `lists_update_owner` | `UPDATE` | L'utilisateur est membre avec `role = 'owner'` |
| `lists_delete_owner` | `DELETE` | L'utilisateur est membre avec `role = 'owner'` |
| `Listes -- creation` | `INSERT` | `auth.uid() = user_id` (seul le createur peut inserer) |

### Policies sur `list_items`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `list_items_select_member_or_public` | `SELECT` | Liste publique OU l'utilisateur est membre |
| `list_items_insert_member` | `INSERT` | L'utilisateur est membre de la liste |
| `list_items_delete_member` | `DELETE` | L'utilisateur est membre de la liste |

Note : owner et member ont les memes droits sur les items. Les deux peuvent ajouter et supprimer.

### Policies sur `list_members`

| Policy | Operation | Condition |
|--------|-----------|-----------|
| `list_members_select` | `SELECT` | L'utilisateur est le membre lui-meme OU est membre de la meme liste |
| `list_members_insert_owner` | `INSERT` | L'owner de la liste OU l'utilisateur s'ajoute lui-meme |
| `list_members_delete_owner` | `DELETE` | L'utilisateur se retire OU est owner de la liste |

---

## Partage et visibilite

### Listes publiques vs privees

- **Publique** (`is_public = true`) : visible par tous les utilisateurs authentifies via les policies RLS. Les listes personnalisees sont creees publiques par defaut. La liste "Suggestions" est publique par defaut.
- **Privee** (`is_public = false`) : visible uniquement par les membres de la liste. La liste "Ma Liste" est creee privee par defaut.

L'owner peut basculer la visibilite via le menu contextuel de la liste (endpoint `PATCH /api/lists/[id]`).

### Flux d'invitation

1. **A la creation** : le modal `CreateListModal` permet de selectionner des amis a inviter. Leurs `friendIds` sont envoyes dans le body du `POST /api/lists`. L'API insere directement les membres sans validation cote invite.

2. **Apres la creation** : l'owner peut ajouter des membres via `POST /api/lists/[id]/members` en fournissant un `userId`. L'API verifie que l'utilisateur cible est bien un ami du createur en consultant la table `friendships`.

3. **Retrait** : un membre peut se retirer lui-meme. L'owner peut retirer n'importe quel membre via `DELETE /api/lists/[id]/members?userId=xxx`.

### Verification d'amitie

Lors de l'ajout d'un membre apres creation, l'API verifie l'existence d'une relation d'amitie dans la table `friendships` en utilisant un pattern de tri des IDs :

```typescript
const { data: friendship } = await supabase
  .from("friendships")
  .select("id")
  .or(`and(user_id.eq.${uid < friendId ? uid : friendId},friend_id.eq.${uid < friendId ? friendId : uid})`)
  .maybeSingle();
```

---

## Routes API

### `GET /api/lists`

Recupere toutes les listes dont l'utilisateur connecte est membre, avec le nombre d'items, le role et la liste des membres.

**Reponse :** `ListSummary[]`

```typescript
type ListSummary = {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  is_public: boolean;
  item_count: number;
  items: Array<{ tmdb_id: number; media_type: string }>;
  role: "owner" | "member";
  members: Array<{
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    role: "owner" | "member";
  }>;
  created_at: string;
};
```

### `POST /api/lists`

Cree une nouvelle liste personnalisee. Si aucune icone n'est fournie, une icone aleatoire est selectionnee parmi un set predefini.

**Body :** `{ name: string; icon?: string; friendIds?: string[] }`

**Reponse :** `201` avec les donnees de la liste creee.

### `GET /api/lists/[id]`

Recupere le detail d'une liste avec ses items enrichis via TMDB (titre, poster). Verifie que l'utilisateur est membre de la liste.

**Reponse :** metadonnees de la liste + `items` enrichis + `members`.

### `PATCH /api/lists/[id]`

Modifie les metadonnees d'une liste. Reserve a l'owner.

**Body :** `{ name?: string; icon?: string; is_public?: boolean }`

**Validation :** nom non vide, max 30 caracteres.

### `DELETE /api/lists/[id]`

Supprime une liste. Reserve a l'owner. Interdit sur les listes `is_default` et `non_deletable`. La suppression en cascade (`ON DELETE CASCADE`) nettoie automatiquement `list_items` et `list_members`.

### `POST /api/lists/[id]/items`

Ajoute un media a une liste. Tout membre (owner ou member) peut ajouter. Les doublons sont ignores (code PostgreSQL `23505`).

**Body :** `{ tmdbId: number; mediaType: "movie" | "tv" }`

### `DELETE /api/lists/[id]/items`

Retire un media d'une liste. Tout membre peut retirer.

**Query params :** `tmdbId` et `mediaType`

### `POST /api/lists/[id]/members`

Ajoute un ami comme membre. Reserve a l'owner. Verifie l'amitie dans `friendships`.

**Body :** `{ userId: string }`

### `DELETE /api/lists/[id]/members`

Retire un membre. L'owner peut retirer n'importe qui. Un membre peut se retirer lui-meme.

**Query params :** `userId`

### `GET /api/lists/preview`

Recupere un apercu de toutes les listes de l'utilisateur avec les 20 premiers items enrichis via TMDB (titre, poster, backdrop, note, genres). Utilise pour les previsualisations sur la page d'accueil.

**Reponse :** `{ lists: ListPreview[] }`

```typescript
interface ListPreview {
  id: string;
  name: string;
  icon: string | null;
  item_count: number;
  items: ListPreviewItem[];
}
```

### `GET /api/my-list`

Raccourci pour recuperer les items de la liste par defaut "Ma Liste" de l'utilisateur, enrichis via TMDB.

### `POST /api/my-list`

Ajoute ou retire un media de la liste par defaut. Cree automatiquement la liste "Ma Liste" si elle n'existe pas encore (`getOrCreateDefaultList`).

**Body :** `{ tmdbId: number; mediaType: "movie" | "tv"; action: "add" | "remove" }`

### `GET /api/suggestions-list`

Recupere les items de la liste "Suggestions" de l'utilisateur.

### `POST /api/suggestions-list`

Ajoute ou retire un media de la liste "Suggestions". Cree automatiquement la liste si elle n'existe pas (`getOrCreateSuggestionsList`). Utilise `upsert` avec `ignoreDuplicates`.

**Body :** `{ tmdbId: number; mediaType: "movie" | "tv"; action: "add" | "remove" }`

### `GET /api/friends/[userId]/lists`

Recupere les listes publiques d'un ami (nom, icone, nombre d'items). Utilise pour afficher les listes sur le profil d'un ami.

---

## Frontend

### Page principale : `/ma-liste`

**Fichier :** `src/app/(main)/ma-liste/page.tsx`

Composant client (`"use client"`) qui affiche l'interface complete de gestion des listes.

**Structure de la page :**

1. **En-tete** : titre "Mes Listes" avec bouton "Nouvelle liste"
2. **Onglets horizontaux** : un onglet par liste, avec icone, nom, compteur d'items et avatars des membres pour les listes collaboratives
3. **Menu contextuel** (owner uniquement) : renommer, basculer public/prive, supprimer
4. **Formulaire de renommage inline** : apparait sous les onglets lorsqu'on clique "Renommer"
5. **Indicateur de collaboration** : affiche les noms des membres partages
6. **Grille d'items** : affiche les posters des films/series avec boutons lecture et suppression

**Etats geres :**
- `activeListId` : liste actuellement selectionnee
- `createOpen` : modal de creation ouverte
- `renamingListId` / `renameValue` : renommage en cours
- `watchMovieId` / `streamOpen` / `activeStream` : lecture de medias

### Composants

#### `CreateListModal`

**Fichier :** `src/components/lists/CreateListModal.tsx`

Modal de creation d'une nouvelle liste utilisant Radix UI Dialog avec animations Framer Motion.

**Fonctionnalites :**
- Champ de nom (max 30 caracteres)
- Selecteur d'icone avec 24 emojis predefinis
- Champ de saisie d'emoji personnalise
- Selection d'amis a inviter (via `useFriends()`)
- Boutons Annuler/Creer

#### `ListPickerSheet`

**Fichier :** `src/components/lists/ListPickerSheet.tsx`

Bottom sheet (dialogue ancre en bas) permettant d'ajouter un media a une ou plusieurs listes depuis n'importe quelle page du catalogue.

**Fonctionnalites :**
- Affiche toutes les listes de l'utilisateur
- Indicateur de presence (coche) si le media est deja dans la liste
- Bascule ajout/retrait en un clic
- Bouton "Nouvelle liste" en bas du sheet

#### `ListSelector`

**Fichier :** `src/components/lists/ListSelector.tsx`

Bouton compact (rond) a placer sur les cartes de medias. Affiche une coche si le media est dans au moins une liste, un "+" sinon. Ouvre le `ListPickerSheet` au clic.

**Props :** `tmdbId`, `mediaType`, `size` (`"sm"` | `"md"`), `className`

#### `MemberAvatars` (composant interne)

Affiche les avatars empiles des membres d'une liste collaborative (max 4 visibles + compteur "+N").

#### `ListContextMenu` (composant interne)

Menu contextuel Radix `DropdownMenu` sur chaque onglet de liste (owner uniquement). Actions : Renommer, Basculer public/prive, Supprimer.

#### `ListItemsGrid` (composant interne)

Grille responsive (2-6 colonnes selon la largeur) affichant les posters des items. Charge les items via `fetch(/api/lists/[id])` dans un `useEffect`. Affiche un skeleton loader pendant le chargement et un etat vide avec lien vers le catalogue.

### Hooks

#### `useMyLists()`

**Fichier :** `src/hooks/use-lists.ts`

Hook React Query qui recupere toutes les listes de l'utilisateur via `GET /api/lists`.

- **Query key :** `["lists", user?.id]`
- **Stale time :** 5 minutes
- **Desactive** si l'utilisateur n'est pas connecte

#### `useToggleItemInList()`

Mutation pour ajouter ou retirer un item d'une liste specifique. Invalide les query keys `["lists"]` et `["my-list"]` en cas de succes.

#### `useCreateList()`

Mutation pour creer une nouvelle liste via `POST /api/lists`.

#### `useUpdateList()`

Mutation pour modifier une liste via `PATCH /api/lists/[id]`.

#### `useDeleteList()`

Mutation pour supprimer une liste via `DELETE /api/lists/[id]`.

#### `useAddListMember()`

Mutation pour ajouter un membre via `POST /api/lists/[id]/members`.

#### `useRemoveListMember()`

Mutation pour retirer un membre via `DELETE /api/lists/[id]/members`.

#### `useMyList()` / `useIsInMyList()` / `useToggleMyList()`

**Fichier :** `src/hooks/use-list.ts`

Hooks dedies a la liste par defaut "Ma Liste" :
- `useMyList()` : recupere les items enrichis via `GET /api/my-list`
- `useIsInMyList(tmdbId, mediaType)` : verifie si un media est dans la liste par defaut
- `useToggleMyList()` : ajoute/retire via `POST /api/my-list`

---

## Icones emoji et personnalisation

### Icones predefinies

Le systeme propose 24 emojis predefinis dans `CreateListModal` :

```
🎬 🎭 🍿 ⭐ 🔥 💫 🎯 🎪
🌟 🎥 📽️ 🎞️ 🏆 💎 🚀 🌙
🎸 🧨 🎃 👻 🦁 🐉 🌺 🎨
```

### Icone aleatoire

Lorsqu'aucune icone n'est choisie lors de la creation, une icone est selectionnee aleatoirement parmi un sous-ensemble de 12 emojis cote serveur :

```
🎬 🎭 🍿 ⭐ 🔥 💫 🎯 🎪 🌟 🎥 📽️ 🎞️
```

### Emoji personnalise

L'utilisateur peut saisir son propre emoji (max 2 caracteres pour supporter les emojis composes) dans le champ de texte du modal de creation. L'emoji personnalise a priorite sur la selection dans la grille.

### Affichage

L'icone est affichee a cote du nom de la liste dans :
- Les onglets de la page "Mes Listes"
- Le `ListPickerSheet`
- L'etat vide de la grille d'items
- Les previsualisations de listes d'amis

Si `icon` est `null`, l'emoji par defaut "🎬" est utilise comme fallback cote frontend (`list.icon ?? "🎬"`).

---

## Schema des fichiers

```
src/
  app/
    (main)/
      ma-liste/
        page.tsx                          # Page principale des listes
    api/
      lists/
        route.ts                          # GET (toutes les listes) + POST (creation)
        preview/
          route.ts                        # GET (apercu avec items enrichis TMDB)
        [id]/
          route.ts                        # GET (detail) + PATCH (modification) + DELETE
          items/
            route.ts                      # POST (ajout item) + DELETE (retrait item)
          members/
            route.ts                      # POST (ajout membre) + DELETE (retrait membre)
      my-list/
        route.ts                          # GET + POST pour la liste par defaut
      suggestions-list/
        route.ts                          # GET + POST pour la liste Suggestions
      friends/
        [userId]/
          lists/
            route.ts                      # GET listes publiques d'un ami
  components/
    lists/
      CreateListModal.tsx                 # Modal de creation de liste
      ListPickerSheet.tsx                 # Bottom sheet d'ajout a une liste
      ListSelector.tsx                    # Bouton compact pour cartes de medias
  hooks/
    use-lists.ts                          # Hooks React Query pour les multi-listes
    use-list.ts                           # Hooks pour la liste par defaut "Ma Liste"
supabase/
  migrations/
    001_initial_schema.sql                # Schema initial (lists, list_items)
    006_reset_to_supabase_auth.sql        # Recreation du schema avec Supabase Auth
    011_multi_lists.sql                   # Migration multi-listes collaboratives
```
