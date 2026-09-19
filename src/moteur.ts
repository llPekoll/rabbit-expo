/**
 * Le moteur du jeu, re-exporte APRES installation du DOM.
 *
 * POURQUOI CE FICHIER. Les imports ES sont HISSES : dans un module qui fait
 *
 *     import { installerDomMoteur } from './dom-moteur';
 *     import { BurrowScene } from '../jeu/src/game/scenes/BurrowScene';
 *     installerDomMoteur();
 *
 * ...BurrowScene est evalue AVANT l'appel, et certains modules du moteur
 * lisent `window` des leur chargement. L'ordre voulu s'obtient en mettant
 * l'installation et les imports dans le MEME module, l'installation en
 * premier : un `import` qui suit une instruction de module est evalue apres
 * elle.
 *
 * Les imports sont STATIQUES parce que Metro ne resout pas un
 * `import('../jeu/src/...')` dynamique : il garde le chemin tel quel dans le
 * bundle et le runtime le resout depuis la racine du projet, perdant le `..`
 * — d'ou "Unable to resolve module ./rabbit-royale/src/...".
 */
import { installerDomMoteur } from './dom-moteur';

installerDomMoteur();

export { BurrowScene } from '../jeu/src/game/scenes/BurrowScene';
export { IslandScene } from '../jeu/src/game/scenes/IslandScene';
export { loadAllAssets } from '../jeu/src/game/services/AssetLoader';
export { setSlopeRenderer } from '../jeu/src/game/island/slopes';
export {
  PORTRAIT_W, PORTRAIT_H, landscapeCanvas,
} from '../jeu/src/game/Application';
