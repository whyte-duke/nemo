# Authentification

> Derniere mise a jour : 2026-03-04 | Source : analyse du codebase reel

## Resume rapide

Nemo utilise **Supabase Auth** (email/password) comme systeme d'authentification primaire. Un JWT est stocke dans un cookie HttpOnly et verifie par le middleware sur chaque requete protegee. Les roles (`free < sources < vip < admin`) controlent l'acces aux fonctionnalites. Un systeme d'invitation par token permet d'attribuer un role a l'inscription et de creer automatiquement des liens d'amitie. Une **session Jellyfin** optionnelle et independante permet d'acceder aux fonctionnalites de streaming personnel.

---

## Flux d'Inscription

```
 Navigateur                     Serveur Next.js              Supabase             PostgreSQL
 ─────────                     ───────────────              ────────             ──────────
     │                               │                          │                     │
     │  POST /inscription            │                          │                     │
     │  (email, password,            │                          │                     │
     │   display_name,               │                          │                     │
     │   ?invite=TOKEN)              │                          │                     │
     │──────────────────────────────>│                          │                     │
     │                               │  supabase.auth.signUp()  │                     │
     │                               │─────────────────────────>│                     │
     │                               │                          │  INSERT auth.users  │
     │                               │                          │────────────────────>│
     │                               │                          │                     │
     │                               │                          │  TRIGGER            │
     │                               │                          │  on_auth_user_created
     │                               │                          │  -> handle_new_user()
     │                               │                          │  -> INSERT profiles │
     │                               │                          │                     │
     │                               │     JWT (si email         │                     │
     │                               │     confirme) ou          │                     │
     │                               │     email de confirmation │                     │
     │<──────────────────────────────│<─────────────────────────│                     │
     │                               │                          │                     │
     │  [Si invite token present]    │                          │                     │
     │  POST /api/invite/redeem      │                          │                     │
     │──────────────────────────────>│  getAuthUser()           │                     │
     │                               │  Valider token           │                     │
     │                               │  UPDATE profiles.role    │                     │
     │                               │  INSERT invite_uses      │────────────────────>│
     │                               │                          │  TRIGGER            │
     │                               │                          │  trg_auto_friendship│
     │                               │                          │  -> INSERT          │
     │                               │                          │     friendships     │
     │<──────────────────────────────│                          │                     │
     │  Redirection /onboarding      │                          │                     │
     │  (ou / si VIP)                │                          │                     │
```

### Etapes detaillees

1. L'utilisateur accede a `/inscription` et remplit le formulaire (nom, email, mot de passe)
2. Le composant `InscriptionContent` appelle `supabase.auth.signUp()` via le client browser
3. Les options incluent `display_name` dans `user_metadata` et un `emailRedirectTo` (vers `/connexion` avec le token d'invitation si present)
4. Supabase Auth cree l'utilisateur dans `auth.users`
5. Le trigger `on_auth_user_created` execute `handle_new_user()` qui insere automatiquement une ligne dans `profiles` avec `username` et `avatar_url` extraits des metadonnees
6. Si la confirmation email est requise, l'utilisateur recoit un email et le client poll la session toutes les 3 secondes via `supabase.auth.getSession()`
7. Si un token d'invitation est present (`?invite=TOKEN`), le client appelle `POST /api/invite/redeem` qui met a jour le role et enregistre l'utilisation
8. Le trigger `trg_auto_friendship` sur `invite_uses` cree automatiquement les liens d'amitie (profondeur 1 et 2)

---

## Flux de Connexion

```
 Navigateur                     Serveur Next.js              Supabase
 ─────────                     ───────────────              ────────
     │                               │                          │
     │  /connexion                   │                          │
     │  (email, password)            │                          │
     │──────────────────────────────>│                          │
     │                               │  signInWithPassword()    │
     │                               │─────────────────────────>│
     │                               │                          │
     │                               │     JWT cookie HttpOnly  │
     │<──────────────────────────────│<─────────────────────────│
     │                               │                          │
     │  [Si invite dans URL]         │                          │
     │  POST /api/invite/redeem      │                          │
     │──────────────────────────────>│  Activer token           │
     │<──────────────────────────────│                          │
     │                               │                          │
     │  Redirection /                │                          │
```

### Etapes detaillees

1. L'utilisateur accede a `/connexion` et entre ses identifiants
2. Le composant `ConnexionContent` appelle `supabase.auth.signInWithPassword()` via le client browser
3. En cas de succes, un JWT est stocke dans un cookie HttpOnly par Supabase SSR
4. Si un token d'invitation est present dans l'URL (`?invite=TOKEN`), l'effet `useEffect` detecte l'utilisateur authentifie et appelle `POST /api/invite/redeem`
5. Redirection vers `/` (ou `/onboarding` selon le role)

---

## Middleware de Protection

Le middleware (`src/lib/supabase/middleware.ts`) intercepte chaque requete via la fonction `updateSession()`.

### Logique du middleware

```
 Requete entrante
       │
       v
 Rafraichir le JWT Supabase
 (supabase.auth.getUser())
       │
       v
 ┌─────────────────────────────────┐
 │  Page protegee (/profil/*) ?    │
 │  ET pas d'utilisateur ?         │──── OUI ──> Redirect /connexion
 └─────────────┬───────────────────┘
               │ NON
               v
 ┌─────────────────────────────────┐
 │  Page auth (/connexion,         │
 │  /inscription) ET utilisateur ? │──── OUI ──> Redirect /
 └─────────────┬───────────────────┘
               │ NON
               v
 ┌─────────────────────────────────┐
 │  Utilisateur authentifie ?      │
 │  ET pas API/auth/onboarding/    │
 │  fichier statique ?             │──── OUI ──> Verifier onboarding
 └─────────────┬───────────────────┘             │
               │ NON                             v
               v                    ┌───────────────────────────┐
         Continuer                  │ Cookie nemo_onboarding_done│
                                    │ = "1" ?                    │
                                    └──────┬────────────────────┘
                                           │
                                    OUI: continuer
                                    NON: lire profiles.onboarding_completed
                                         │
                                    Termine: poser le cookie + continuer
                                    Pas termine: redirect /onboarding
```

### Routes concernees

| Type de route | Exemple | Comportement |
|---------------|---------|-------------|
| Pages auth | `/connexion`, `/inscription` | Redirige vers `/` si deja connecte |
| Pages protegees | `/profil/*` | Redirige vers `/connexion` si pas connecte |
| Pages standard | `/films`, `/series`, `/decouvrir` | Verifie onboarding si connecte |
| Routes API | `/api/*` | Pas de redirection (auth geree dans chaque handler) |
| Fichiers statiques | `*.ico`, `*.png` | Pas de verification |

### Optimisation onboarding

Le middleware utilise un cookie `nemo_onboarding_done` (HttpOnly, 1 an) pour eviter un appel a la base de donnees sur chaque requete. Ce cookie est pose la premiere fois que `profiles.onboarding_completed` est detecte comme `true`.

---

## Fonctions Helper d'Authentification

Fichier : `src/lib/auth/session.ts`

### getAuthUser()

```typescript
export async function getAuthUser(): Promise<User | null>
```

- Cree un client Supabase server (avec cookies)
- Appelle `supabase.auth.getUser()` pour verifier le JWT
- Retourne l'objet `User` Supabase ou `null`
- Utilisee dans tous les route handlers pour verifier l'authentification

### getAuthUserWithName()

```typescript
export async function getAuthUserWithName(): Promise<{ id: string; name: string } | null>
```

- Appelle `getAuthUser()` en interne
- Extrait le nom depuis les metadonnees utilisateur, avec fallback en cascade :
  1. `user_metadata.display_name`
  2. `user_metadata.full_name`
  3. `user_metadata.name`
  4. Partie locale de l'email (`email.split("@")[0]`)
  5. `"Utilisateur"` par defaut

### getAuthUserWithRole()

```typescript
export async function getAuthUserWithRole(): Promise<{ id: string; name: string; role: UserRole } | null>
```

- Appelle `getAuthUser()` puis lit le role dans la table `profiles` via le **client admin** (bypass RLS)
- Retourne `{ id, name, role }` avec le role par defaut `"free"` si absent
- **Utilise le client admin** car un utilisateur ne peut pas lire son propre role via les policies RLS standard (le role est protege par le trigger anti-escalade)

### requireRole(minRole)

```typescript
export async function requireRole(minRole: UserRole): Promise<{ id: string; name: string; role: UserRole } | null>
```

- Appelle `getAuthUserWithRole()` puis compare l'ordre numerique du role
- Retourne l'utilisateur si son role est suffisant, `null` sinon
- Utilisee pour proteger les routes API et fonctionnalites premium

---

## Systeme de Roles

### Hierarchie

```
 free (0) ──> sources (1) ──> vip (2) ──> admin (3)
   │              │               │            │
   │              │               │            └── Administration complete
   │              │               └── Download Jellyfin partage + tous services
   │              └── StreamFusion API / sources de streaming / M3U
   └── Acces de base (site, Jellyfin personnel)
```

| Role | Ordre | Permissions | Attribution |
|------|-------|-------------|-------------|
| `free` | 0 | Acces de base au site, Jellyfin personnel | Par defaut a l'inscription |
| `sources` | 1 | `free` + acces aux sources StreamFusion, API streaming, M3U | Via token d'invitation |
| `vip` | 2 | `sources` + telechargement Jellyfin partage + tous les services actives | Via token d'invitation |
| `admin` | 3 | Administration complete | **Dashboard SQL uniquement** |

### Securite des roles

La protection est assuree par le trigger `prevent_role_escalation()` (migrations 008 et 010) :

| Contexte | Peut changer le role ? | Details |
|----------|----------------------|---------|
| JWT utilisateur (`authenticated`) | Non | Le trigger revient silencieusement a l'ancien role |
| Backend Next.js (`service_role`) | Oui, sauf `admin` | Peut attribuer `free`, `sources`, `vip` via le client admin |
| Dashboard SQL (connexion directe) | Oui, tout | Seul moyen d'attribuer le role `admin` |

Contrainte supplementaire : un index unique `idx_one_admin_only` garantit qu'un seul utilisateur peut avoir le role `admin` dans toute la base.

### Type TypeScript

```typescript
export type UserRole = "free" | "sources" | "vip" | "admin";
```

---

## Tokens d'Invitation

### Schema

```
 invite_tokens                    invite_uses
 ─────────────                    ───────────
 id (UUID PK)                     id (UUID PK)
 token (TEXT UNIQUE)               token_id (FK -> invite_tokens)
 role (free|sources|vip)           user_id (FK -> profiles)
 label (TEXT, memo admin)          used_at (TIMESTAMPTZ)
 created_by (FK -> profiles)       UNIQUE(token_id, user_id)
 max_uses (INTEGER, defaut 1)
 use_count (INTEGER, defaut 0)
 expires_at (TIMESTAMPTZ, nullable)
 created_at (TIMESTAMPTZ)
```

### Flux d'activation

```
 1. Admin cree un token
    POST /api/invite/generate (requiert ADMIN_INVITE_SECRET)
       │
       v
 2. Lien partage : /inscription?invite=TOKEN
       │
       v
 3. Utilisateur s'inscrit
    Le client valide le token via GET /api/invite/validate
       │
       v
 4. Apres confirmation email (ou immediatement)
    POST /api/invite/redeem
       │
       ├── Verifie : token valide, non expire, uses < max_uses
       ├── Verifie : utilisateur n'a pas deja utilise ce token
       ├── UPDATE profiles SET role = token.role
       ├── Si VIP : pre-configure Jellyfin partage + tous services
       ├── INSERT invite_uses (token_id, user_id)
       └── UPDATE invite_tokens SET use_count = use_count + 1
              │
              v
 5. Trigger trg_auto_friendship (sur INSERT invite_uses)
       │
       ├── Profondeur 1 : inviteur <-> nouvel invite
       └── Profondeur 2 : amis existants de l'inviteur <-> nouvel invite
```

### Securite

- La table `invite_tokens` a RLS active **sans aucune policy** : inaccessible via la cle anonyme ou le JWT utilisateur
- Seul le client admin (service role) peut lire et modifier les tokens
- Les tokens sont generes par `gen_random_bytes(16)` encode en hexadecimal (32 caracteres)

---

## Session Jellyfin

Fichier : `src/lib/auth/jellyfin-session.ts`

La session Jellyfin est **independante** de Supabase Auth. Elle permet d'acceder aux fonctionnalites du serveur Jellyfin personnel de l'utilisateur.

### Fonctionnement

```
 1. Utilisateur se connecte a son serveur Jellyfin
    (via le hook use-jellyfin-auth)
       │
       v
 2. Le token Jellyfin est stocke dans un cookie "jellyfin_token"
       │
       v
 3. Cote serveur : getJellyfinSession()
    - Lit le cookie "jellyfin_token"
    - Appelle getCurrentUser(token) sur le serveur Jellyfin
    - Retourne { user: { id, name }, token } ou null
       │
       v
 4. Utilise par les routes API Jellyfin pour :
    - Recuperer l'historique de lecture
    - Acceder aux items en cours (resume points)
    - Lancer une lecture directement depuis Nemo via HLS
```

### Fonctions

| Fonction | Retour | Usage |
|----------|--------|-------|
| `getJellyfinSession()` | `{ user: JellyfinSessionUser, token: string } \| null` | Routes API qui ont besoin du token |
| `getJellyfinUser()` | `JellyfinSessionUser \| null` | Routes API qui ont seulement besoin de l'identite |

### Stockage en base

La migration 013 ajoute des colonnes a `profiles` pour persister la session Jellyfin cote serveur :
- `jellyfin_user_id` : identifiant Jellyfin de l'utilisateur
- `jellyfin_user_token` : token d'authentification (jamais expose au client)
- `jellyfin_display_name` : nom affiche sur Jellyfin

---

## Clients Supabase

Trois variantes de client sont utilisees selon le contexte :

| Variante | Fichier | Contexte | RLS | Session |
|----------|---------|----------|-----|---------|
| **Browser** | `src/lib/supabase/client.ts` | Client Components | Actif | Singleton, cookies navigateur |
| **Server** | `src/lib/supabase/server.ts` | Server Components, Route Handlers | Actif | Par requete, cookies Next.js |
| **Admin** | `src/lib/supabase/admin.ts` | Operations privilegiees | **Desactive** | Pas de session persistee |

Le client **admin** est utilise pour :
- Lire le role d'un utilisateur dans `getAuthUserWithRole()`
- Activer des tokens d'invitation (`/api/invite/redeem`)
- Operations de la download queue
- Toute operation qui necessite de contourner les politiques RLS

---

## Routes OAuth (Trakt, Letterboxd)

Les routes `/api/auth/trakt` et `/api/auth/letterboxd` sont des flux **OAuth d'import de donnees**, pas d'authentification primaire. Elles permettent d'importer l'historique de visionnage et les notes depuis ces services externes. L'utilisateur doit deja etre authentifie via Supabase Auth avant d'utiliser ces flux.

---

## Fichiers Sources

Ce document a ete genere en lisant les fichiers suivants :

- `src/lib/auth/session.ts` -- fonctions helper d'authentification (getAuthUser, getAuthUserWithRole, requireRole)
- `src/lib/auth/jellyfin-session.ts` -- session Jellyfin independante (cookie-based)
- `src/lib/supabase/middleware.ts` -- middleware de protection des routes et rafraichissement JWT
- `src/lib/supabase/server.ts` -- client Supabase server (cookies Next.js, RLS actif)
- `src/lib/supabase/client.ts` -- client Supabase browser (singleton, RLS actif)
- `src/lib/supabase/admin.ts` -- client Supabase admin (service role, bypass RLS)
- `src/app/(auth)/connexion/page.tsx` -- page de connexion (signInWithPassword + invite redeem)
- `src/app/(auth)/inscription/page.tsx` -- page d'inscription (signUp + invite validation + email polling)
- `src/app/api/invite/redeem/route.ts` -- activation de token d'invitation
- `supabase/migrations/001_initial_schema.sql` -- trigger handle_new_user, table profiles
- `supabase/migrations/008_roles_and_invites.sql` -- roles, trigger anti-escalade, invite_tokens, invite_uses
- `supabase/migrations/010_admin_role.sql` -- role admin, contrainte unicite, trigger renforce
- `supabase/migrations/012_friendships.sql` -- auto-friendship on invite, table friendships
- `supabase/migrations/013_jellyfin_user_session.sql` -- colonnes session Jellyfin sur profiles
