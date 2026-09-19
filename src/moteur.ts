/**
 * Le moteur du jeu, re-exporte APRES installation du DOM.
 *
 * POURQUOI CE FICHIER. Les imports ES sont HISSES : dans un module qui fait
 *
 *     import { installerDomMoteur } from './dom-moteur';
 *     import { BurrowScene } from '../jeu/game/scenes/BurrowScene';
 *     installerDomMoteur();
 *
 * ...BurrowScene est evalue AVANT l'appel, et certains modules du moteur
 * lisent `window` des leur chargement. L'ordre voulu s'obtient en mettant
 * l'installation et les imports dans le MEME module, l'installation en
 * premier : un `import` qui suit une instruction de module est evalue apres
 * elle.
 *
 * Les imports sont STATIQUES parce que Metro ne resout pas un
 * `import('../jeu/...')` dynamique : il garde le chemin tel quel dans le
 * bundle et le runtime le resout depuis la racine du projet, perdant le `..`
 * — d'ou "Unable to resolve module ./rabbit-royale/src/...".
 */
import { installerDomMoteur } from './dom-moteur';

installerDomMoteur();

/**
 * L'arcade-kit rend `undefined` pour ses propres assets.
 *
 * Il les expose par `assetUrl(mod)` : `typeof mod === 'string' ? mod :
 * mod.src` (asset-url.ts). Sur le web, `import x from './y.png'` donne une
 * chaine ; avec Metro c'est un NUMERO de module, donc `mod.src` vaut
 * `undefined`.
 *
 * Le jeu charge alors `{ src: undefined }`, et le Resolver de Pixi appelle
 * `url.startsWith()` dessus : "Cannot read property 'startsWith' of
 * undefined", avant meme notre loader.
 *
 * On ne peut PAS corriger `assetUrl` apres coup : `CARROT_URL =
 * assetUrl(carrotPng)` est evalue au chargement du module du kit. C'est donc
 * le LOADER natif qui rattrape `undefined` (voir pixi-rn-assets.ts), en
 * servant l'asset equivalent copie dans assets/kit/.
 */

export { BurrowScene } from '../jeu/game/scenes/BurrowScene';
export { IslandScene } from '../jeu/game/scenes/IslandScene';
export { loadAllAssets } from '../jeu/game/services/AssetLoader';
export { setSlopeRenderer } from '../jeu/game/island/slopes';
export { initTileTextures } from '../jeu/game/services/TileTextures';
export {
  PORTRAIT_W, PORTRAIT_H, landscapeCanvas,
} from '../jeu/game/Application';
