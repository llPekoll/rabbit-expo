# native/ — l'app Expo (Seeker, Android, iOS, puis web)

Cette app importe directement `src/game`, `src/lib`, `src/config` et `src/i18n`
du repo : **une seule source pour le moteur**, pas de copie. Seul le chrome
React (`src/components`, du `<div>`/CSS) est reecrit ici en `<View>`.

Les 9 murs franchis pour faire tourner Pixi v8 en React Native sont documentes
dans `../../expo-pixi-test/TROUVAILLES.md`. Les trois regles qui comptent :

1. `DOMAdapter.set()` avec un adaptateur sans DOM, AVANT toute creation Pixi.
2. `new WebGLRenderer()` — jamais `new Application()` (ResizePlugin appelle
   `globalThis.removeEventListener`, inexistant en RN).
3. `skipExtensionImports: true`, et enregistrer soi-meme les systemes Pixi.

Assets : expo-gl decode via stb_image, qui ne gere PAS le WebP. Le natif ne
reference que les `.png` (voir `tools/webp-to-png.mjs`). Et une texture chargee
depuis `asset.localUri` sort noire : copier le fichier dans
`FileSystem.cacheDirectory` d'abord (mur 9).

## Pieges du repo Next + Expo

**expo-router aspire `src/app/`.** Il prend `src/app` comme racine de routes
si ce dossier existe (`@expo/cli/build/src/start/server/metro/router.js:127`)
— or c'est l'App Router de Next. Metro tente alors d'empaqueter les 21 routes
API serveur et echoue sur `node:crypto` ("the native React runtime does not
include the Node standard library").
→ `app.json` : `expo.extra.router.root = "./app"`. Ce n'est PAS l'option
  `root` du plugin expo-router, qui est ignoree ici.

**Point d'entree du bundle** : `node_modules/expo-router/entry.bundle`,
pas `index.bundle` (`"main": "expo-router/entry"` dans package.json).

## Mur 10 — les detecteurs de formats de Pixi

Au PREMIER `Assets.load`, Pixi teste les formats supportes par la plateforme.
Les detecteurs video (`detectMp4`, `detectOgv`, `detectWebm`,
`detectVideoAlphaMode`) appellent `document.createElement("video")` sans garde
(`assets/detections/utils/testVideoFormat.mjs`) :

    ReferenceError: Property 'document' doesn't exist
      at testVideoFormat -> detectMp4

→ `extensions.remove(detectMp4, detectOgv, detectWebm, detectVideoAlphaMode)`
  dans `src/pixi-rn-init.ts`, avant tout `Assets.load`.

Ce mur n'apparait pas si l'on televerse les textures a la main (ce que faisait
le banc d'essai) : il est propre au systeme `Assets`.

## Mur 11 — l'ordre des parsers du Loader

`Loader._loadResource` retient le PREMIER parser dont `test()` repond vrai
(`assets/loader/Loader.mjs:76-82`). Ajoute par `push()`, le notre passait
APRES `loadTextures`, qui accepte tout `.png` puis tente `new Image()` —
inexistant en RN. La promesse ne se resolvait jamais : `Assets.load` restait
suspendu, sans erreur (symptome : "chargement..." eternel).

→ `Assets.loader.parsers.unshift(loaderRN)`.

## Mur 12 — le Resolver reecrit l'URL

Une fois le parser en tete, sa trace a montre :

    test("assets/bunnies/Bunny Sprite Sheet - Brown.png") -> false

Le `Resolver` de Pixi retire le slash initial : le registre stocke
`/assets/...`, Pixi demande `assets/...`.

→ `moduleDe()` normalise : coupe query/ancre, cherche `assets/`, reajoute le
  slash, et retombe sur le `.png` jumeau si le jeu reference un `.webp`.

## Architecture

Le moteur n'est PAS copie : `metro.config.js` pointe `@/*` et `@config/*` vers
`../rabbit-royale`, et `watchFolders` y donne acces. Une seule source pour les
~42 000 lignes de `src/game`, `src/lib`, `src/config` et `src/i18n`.
`src/asset-registry.ts` (genere) fait de meme pour les 189 assets.

**Etat au 2026-09-19** : une sprite sheet du jeu (bunny brown 256x256) se
charge via `Assets.load` et s'anime sur le Seeker. 12 murs franchis.

## Mur 13 — les alias de Metro et les imports dynamiques

`config.resolver.alias` ne couvre PAS les `await import('@/game/...')` :
l'import statique passe, le dynamique echoue avec "Unable to resolve module".
→ Passer par `config.resolver.resolveRequest`, consulte pour les deux formes.

## Le terrier

`src/BurrowSurface.tsx` monte `BurrowScene` (2 543 lignes du moteur, importees
telles quelles). Ce que la scene demande, et rien de plus :
- `app.screen` et `app.canvas` — ses deux SEULS usages de l'Application Pixi,
  donc un objet minimal suffit (pas de ticker, pas de plugins) ;
- `window.addEventListener('resize')`, fourni par `src/dom-moteur.ts` ;
- l'espace de design d'`Application.resize()` : 960x540 en paysage, 480x860 en
  portrait, echelle uniforme et centree. La scene resout ses cadrages contre
  GAME_W/GAME_H — un mauvais espace et la camera cadre a cote.

`src/dom-moteur.ts` fournit les six APIs navigateur que `src/game` utilise
(addEventListener, matchMedia, innerWidth/Height, devicePixelRatio). Il ne fait
RIEN sur le web : React Native Web y donne le vrai `window`.

ATTENTION pour l'ile : les 8 `document.createElement('canvas')` du moteur
peignent vraiment (ombres, nuages isometriques, pentes). Aucun n'est sur le
chemin du terrier, mais l'ile en depend — il faudra un vrai canvas 2D natif ou
des textures precalculees.
