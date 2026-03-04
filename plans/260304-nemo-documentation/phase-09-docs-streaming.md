---
title: "Phase 09 - Streaming et Lecture"
description: "Documenter le pipeline de streaming : StreamFusion, resolution de flux, qualite, langues, et lecteur video"
skill: none
status: pending
group: "features"
dependencies: []
tags: [documentation, streaming, stremio, video-player]
created: 2026-03-04
updated: 2026-03-04
---

# Phase 09: Streaming et Lecture

**Context:** [[plan|Master Plan]] | **Dependencies:** None | **Status:** Pending

---

## Overview

Generer `docs/features/streaming.md` documentant le pipeline complet de streaming de Nemo : resolution des flux via StreamFusion (addon Stremio), parsing des metadonnees (qualite, langue, codec, HDR, taille), tri et selection, lecteur video, et integration avec les services de debridage.

**Goal:** Un agent IA comprend le pipeline de la recherche d'un flux a la lecture video.

---

## Context & Workflow

### How This Phase Fits Into the Project

- **UI Layer:** Composants `StreamModal`, `MovieWatchModal`, `WatchModal`, `VideoPlayer`
- **Server Layer:** Route `/api/streaming/[imdbId]`, `src/lib/stremio/resolver.ts`
- **Database Layer:** Pas directement (les flux ne sont pas stockes en DB)
- **Integrations:** StreamFusion (Stremio addon), AllDebrid/RealDebrid

### User Workflow

**Trigger:** L'utilisateur clique "Regarder" sur un film ou une serie.

**Steps:**
1. L'UI appelle `GET /api/streaming/[imdbId]` avec la config utilisateur
2. L'API construit l'URL StreamFusion avec la config encodee en Base64
3. StreamFusion retourne les flux disponibles (torrents debrides)
4. `parseStreams()` extrait les metadonnees de chaque flux (qualite, langue, taille, etc.)
5. Les flux sont tries par qualite puis taille
6. L'utilisateur choisit un flux dans `StreamModal`
7. Le lecteur video (`VideoPlayer`) lit le flux

**Success Outcome:** L'utilisateur regarde le contenu en streaming avec la qualite et la langue souhaitees.

### Problem Being Solved

**Pain Point:** Le pipeline de streaming est complexe : configuration Base64, parsing regex, tri multi-criteres.
**Alternative Approach:** Lire resolver.ts (217 lignes) + types stremio + composants player.

### Integration Points

**Upstream Dependencies:** Aucune

**Downstream Consumers:**
- P11 (Downloads) : le debridage utilise les memes sources
- P17 (External Services) : reference StreamFusion et Debrid

---

## Prerequisites & Clarifications

### Questions for User

1. **StreamFusion config:** La config par defaut contient des tokens API (ADToken, apiKey). Sont-ils partages ou par utilisateur ?
   - **Context:** `buildDefaultConfig()` dans resolver.ts contient des tokens en dur.
   - **Assumptions if unanswered:** Documenter la structure de config sans exposer les tokens.
   - **Impact:** Securite de la documentation.

2. **Lecture directe vs debridage:** Tous les flux passent-ils par un service de debridage ?
   - **Context:** La config contient `debrid: true` et `debridDownloader: "AllDebrid"`.
   - **Assumptions if unanswered:** Oui, les flux sont debrides via le service configure.
   - **Impact:** Documentation du pipeline.

### Validation Checklist

- [ ] All questions answered or assumptions explicitly approved
- [ ] User has reviewed phase deliverables and confirmed expectations
- [ ] Dependencies from prior phases are confirmed available
- [ ] Environment variables and credentials are documented
- [ ] Any third-party services/APIs are registered and configured

> [!CAUTION]
> The user configured this checkpoint because proceeding with unresolved questions leads to incorrect implementations requiring rework. Verify all items are checked before continuing.

---

## Requirements

### Functional

- Pipeline complet : recherche -> parsing -> tri -> selection -> lecture
- Configuration StreamFusion documentee (structure, encodage Base64)
- Parsing des metadonnees : qualite (4K/1080p/720p/480p/SD), langue (MULTI/VFF/VOSTFR/VF/VO), codec (AV1/HEVC/AVC/VP9), HDR (HDR10+/DV/HDR10/HDR), taille, source, seeders
- Algorithme de tri documente
- Types TypeScript : ParsedStream, StreamQuality, StreamLanguage, StreamCodec, StreamHDR, StreamFusionConfig
- Composants UI : StreamModal, VideoPlayer

### Technical

- Contenu extrait de : `src/lib/stremio/resolver.ts`, `src/types/stremio.ts`, composants player
- Les regex de parsing documentees avec exemples
- Taille cible : 5-8 KB

---

## Decision Log

### Ne pas documenter les tokens en clair (ADR-P09-01)

**Date:** 2026-03-04
**Status:** Accepted

**Context:** La config StreamFusion contient des tokens API (ADToken, apiKey).

**Decision:** Documenter la structure de la config avec des valeurs placeholder, pas les tokens reels.

**Consequences:**
- **Positive:** Pas de fuite de secrets
- **Negative:** L'agent doit consulter le code pour les valeurs par defaut
- **Neutral:** Standard de securite

---

## Implementation Steps

### Step 0: Test Definition (TDD)

#### 0.1: Verification de contenu

- [ ] Le pipeline complet est documente (6 etapes)
- [ ] Les patterns regex de parsing sont documentes avec exemples
- [ ] L'algorithme de tri est documente
- [ ] Les types TypeScript sont documentes

---

### Step 1: Lire les fichiers sources

#### 1.1: Fichiers a lire

- [ ] `src/lib/stremio/resolver.ts` -- toute la logique de resolution et parsing
- [ ] `src/types/stremio.ts` -- types TypeScript (StremioRawStream, ParsedStream, StreamFusionConfig, etc.)
- [ ] `src/app/api/streaming/[imdbId]/route.ts` -- endpoint API
- [ ] `src/components/player/StreamModal.tsx` -- modal de selection de flux
- [ ] `src/components/player/MovieWatchModal.tsx` -- modal de lecture film
- [ ] `src/components/player/WatchModal.tsx` -- modal de lecture generique
- [ ] `src/components/player/VideoPlayer.tsx` -- lecteur video
- [ ] `src/hooks/use-streaming-availability.ts` -- hook disponibilite
- [ ] `src/hooks/use-streaming-preferences.ts` -- hook preferences
- [ ] `src/lib/m3u.ts` -- generation M3U (si pertinent)

---

### Step 2: Rediger la documentation

#### 2.1: Structure du fichier

```markdown
# Streaming et Lecture

> Derniere mise a jour : 2026-03-04

## Resume rapide

Pipeline : StreamFusion (Stremio addon) -> parsing regex -> tri qualite/taille -> lecteur video.
Sources : torrents debrides via AllDebrid/RealDebrid. Config encodee en Base64.

## Pipeline de Streaming

[Diagramme ASCII]
1. UI demande flux pour un IMDB ID
2. API construit URL StreamFusion (config Base64)
3. StreamFusion retourne les flux bruts
4. parseStreams() extrait metadonnees
5. Tri : qualite (4K > 1080p > 720p) puis taille (desc)
6. UI affiche dans StreamModal
7. Utilisateur choisit -> VideoPlayer

## Configuration StreamFusion

| Champ | Type | Description |
|-------|------|-------------|
| addonHost | string | URL de base StreamFusion |
| service | string[] | Services de debridage actifs |
| languages | string[] | Langues preferees |
| sort | string | Critere de tri |
| maxResults | number | Nombre max de resultats |
| ... | ... | ... |

Encodage : JSON -> encodeURIComponent -> unescape -> btoa -> Base64

## Parsing des Metadonnees

### Qualite
| Pattern Regex | Resultat |
|---------------|----------|
| /2160p\|4K\|UHD/i | "4K" |
| /1080p/i | "1080p" |
| /720p/i | "720p" |
| /480p/i | "480p" |

### Langue
| Pattern | Resultat |
|---------|----------|
| /\bMULTI\b/i | "MULTI" |
| /\bVFF\b/i | "VFF" |
| /\bVOSTFR\b/i | "VOSTFR" |
| ... | ... |

[Idem pour codec, HDR, taille, source, seeders]

## Algorithme de Tri

1. Par qualite : 4K > 1080p > 720p > 480p > SD
2. A qualite egale : par taille decroissante

## Types TypeScript

[Documentation des interfaces principales]

## Composants UI

### StreamModal
[Props, comportement]

### VideoPlayer
[Props, comportement]

## Fichiers Sources
[Liste]
```

---

## Verifiable Acceptance Criteria

**Critical Path:**

- [ ] `docs/features/streaming.md` existe avec contenu reel
- [ ] Le pipeline complet est documente
- [ ] Les regex de parsing sont documentees
- [ ] L'algorithme de tri est documente

**Quality Gates:**

- [ ] Les regex correspondent exactement a resolver.ts
- [ ] Pas de tokens API en clair
- [ ] Aucun placeholder

**Integration:**

- [ ] Lien valide depuis `docs/README.md`

---

## Quality Assurance

### Test Plan

#### Manual Testing

- [ ] **Exactitude regex:** Les patterns correspondent a resolver.ts
  - Expected: 4 categories (qualite, langue, codec, HDR) avec patterns exacts
  - Actual: [To be filled]

#### Automated Testing

```bash
ls docs/features/streaming.md
pnpm exec grep -c '\[TODO\]\|\[TBD\]\|XXX' docs/features/streaming.md && echo "FAIL" || echo "PASS"
```

### Review Checklist

- [ ] **Security:** Pas de tokens en clair
- [ ] **Documentation:** Regex extraits du code reel

---

## Dependencies

### Upstream (Required Before Starting)

- Aucune

### Downstream (Will Use This Phase)

- P11 (Downloads) : partage les memes sources de flux
- P17 (External Services) : reference StreamFusion

### External Services

- Aucun

---

## Completion Gate

### Sign-off

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review passed
- [ ] Documentation updated
- [ ] Phase marked DONE in plan.md
- [ ] Committed: `docs(streaming): phase 09 complete -- streaming et lecture`

---

## Notes

### Technical Considerations

- `buildDefaultConfig()` contient une configuration par defaut avec des tokens -- ne pas les inclure dans la doc
- Le timeout de fetch est de 15 secondes (AbortSignal.timeout(15_000))
- Les resultats sont caches via `next: { revalidate: 300 }` (5 minutes)

### Known Limitations

- Les flux dependent de la disponibilite de StreamFusion
- Le parsing regex peut manquer des formats non standards

### Future Enhancements

- Support de sources alternatives a StreamFusion
- Cache local des flux resolus

---

**Previous:** [[phase-08-docs-social|Phase 08: Graphe Social]]
**Next:** [[phase-10-docs-jellyfin|Phase 10: Jellyfin]]
