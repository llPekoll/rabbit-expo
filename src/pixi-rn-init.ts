/**
 * Enregistrement manuel des systemes Pixi pour React Native.
 *
 * Avec `skipExtensionImports: true`, Pixi ne charge plus `browserAll`
 * (accessibility / dom / events / spritesheet / filters / rendering) :
 * c'est ce qui ecrasait notre DOMAdapter et reclamait un vrai DOM.
 * En contrepartie, on declare ici ce dont le jeu a besoin.
 *
 * On prend les sous-chemins publics sans dependance DOM.
 * On laisse : ./accessibility, ./events, ./dom, ./text-html, ./html-source.
 *
 * Note : le pipeline de rendu lui-meme vit dans l'entree principale 'pixi.js',
 * deja importee par App.tsx — il n'y a pas de sous-chemin './rendering'.
 */

import 'pixi.js/graphics';
import 'pixi.js/mesh';
import 'pixi.js/particle-container';
import 'pixi.js/sprite-nine-slice';
import 'pixi.js/sprite-tiling';
import 'pixi.js/text-bitmap';
import 'pixi.js/filters';

export const PIXI_RN_INIT = true;

/**
 * Retire les detecteurs de formats qui exigent un DOM.
 *
 * Au PREMIER `Assets.load`, Pixi teste les formats supportes par la
 * plateforme. Les detecteurs video passent par `testVideoFormat`, qui fait
 * `document.createElement("video")` sans garde
 * (assets/detections/utils/testVideoFormat.mjs) — d'ou un
 * "ReferenceError: Property 'document' doesn't exist" en React Native.
 *
 * Le jeu ne charge aucune video : on retire ces trois detecteurs. Ceux des
 * images (avif, webp) restent, ils n'ont pas besoin du DOM.
 *
 * NB : `detectVideoAlphaMode` fait le meme appel, mais c'est une FONCTION et
 * non une extension — `extensions.remove()` la refuse avec "Extension class
 * must have an extension object". Elle n'est appelee que par VideoSource,
 * qu'on n'enregistre pas ici : rien a neutraliser.
 */
import { detectMp4, detectOgv, detectWebm, extensions } from 'pixi.js';

extensions.remove(detectMp4, detectOgv, detectWebm);
