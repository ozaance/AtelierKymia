# Assets à fournir — Atelier Kymia

Les dossiers `assets/img/` et `assets/video/` doivent contenir les médias
référencés par le HTML. Tant qu'ils sont absents, les pages s'affichent mais
les visuels sont vides (les balises ont `width`/`height` et un fond `--fond-produit`).

## Images (`assets/img/`)

Format conseillé : JPEG qualité 80, largeur ~1200 px, jeu responsive `.webp`
optionnel. Fournir des variantes `@2x` si besoin.

| Fichier attendu | Usage | Dimensions | Page |
|---|---|---|---|
| `hero-poster.jpg` | Poster de la vidéo hero (LCP) | 1920×1080 (16:9) | index |
| `collection-douceurs.jpg` | Tuile collection Les Douceurs | 800×800 | index |
| `collection-eclats.jpg` | Tuile collection Les Éclats | 800×800 | index |
| `collection-couleurs.jpg` | Tuile collection Les Couleurs | 800×800 | index |
| `histoire.jpg` | Visuel section « Notre histoire » | 1000×1000 | index |
| `produit-01-a.jpg` | Image principale produit (LCP fiche) | 900×900 | produit |
| `produit-01-b.jpg` – `produit-01-e.jpg` | Vignettes galerie produit | 900×900 | produit |
| `collection-douceurs.jpg` | OG image collection | 1200×630 | collection |

## Vidéos (`assets/video/`)

| Fichier attendu | Usage | Format |
|---|---|---|
| `hero-mobile-hevc.mp4` | Hero portrait (mobile), original HEVC — prioritaire | HEVC 1080×1920, ~1 Mo |
| `hero-mobile.mp4` | Hero portrait (mobile), repli | H.264 540×960, ~2,8 Mo |
| `hero-hevc.mp4` | Hero desktop, original HEVC — prioritaire | HEVC 1920×1080, ~1,7 Mo |
| `hero.mp4` | Hero desktop, repli | H.264 1280×720, ~4,8 Mo |

Sources : dossier `Hero Kymia/`. Posters : `hero-poster.jpg` (16:9) et
`hero-poster-mobile.jpg` (9:16). Images produits : dossier
`image produit atelier kymia/` → `produit-01-a.jpg` … `produit-09-a.jpg`
(une image par produit, voir `data/products.json`).

### Commandes ffmpeg d'exemple

```bash
# Desktop mp4 (H.264, sans audio, < 3 Mo)
ffmpeg -i source.mov -an -vf "scale=1920:-2" -c:v libx264 -crf 24 \
  -preset slow -movflags +faststart assets/video/hero.mp4

# Desktop webm (VP9, sans audio)
ffmpeg -i source.mov -an -vf "scale=1920:-2" -c:v libvpx-vp9 -crf 32 -b:v 0 \
  assets/video/hero.webm

# Mobile portrait mp4 (sans audio)
ffmpeg -i source-mobile.mov -an -vf "scale=900:-2" -c:v libx264 -crf 24 \
  -movflags +faststart assets/video/hero-mobile.mp4

# Poster de la vidéo (première frame représentative)
ffmpeg -i source.mov -ss 00:00:01 -frames:v 1 -q:v 2 assets/img/hero-poster.jpg
```

## Bonnes pratiques déjà en place

- Vidéo hero `muted`, `playsinline`, `preload="metadata"` + poster : pas de
  blocage du rendu, repli automatique en image si `prefers-reduced-motion`.
- Image produit principale en `fetchpriority="high"` + `decoding="async"`
  (candidat LCP), `width`/`height` pour éviter le CLS.
- Toutes les autres images en `loading="lazy" decoding="async"`.
