/**
 * Les quelques APIs navigateur que le moteur du jeu attend.
 *
 * `src/game` est du TypeScript portable a 95% : sur 79 fichiers, 16 touchent
 * au DOM, et l'inventaire complet tient en six APIs (compte fait sur tout
 * src/game) :
 *
 *   window.addEventListener / removeEventListener   9 + 9
 *   window.matchMedia                               6
 *   window.innerWidth / innerHeight                 6 + 6
 *   window.setTimeout / clearTimeout                5 + 4   (deja en RN)
 *   window.devicePixelRatio                         1
 *   document.createElement('canvas')                8       (PAS pour le terrier)
 *
 * On les fournit plutot que de reecrire le moteur : une seule source pour le
 * web et le natif, et un fix de gameplay profite aux deux.
 *
 * A APPELER AVANT d'importer quoi que ce soit de `@/game`.
 *
 * LE CANVAS 2D N'EST PAS COUVERT. Les 8 `createElement('canvas')` peignent
 * vraiment (ombres d'ile, nuages isometriques, pentes) — un faux canvas
 * rendrait des textures vides. Verifie : AUCUN n'est sur le chemin du
 * terrier (ils appartiennent a l'ile). Quand l'ile viendra, il faudra soit
 * un vrai canvas 2D natif, soit precalculer ces textures.
 */
import { Dimensions, PixelRatio, Platform } from 'react-native';

type Ecouteur = (e: any) => void;

let installe = false;

export function installerDomMoteur() {
  if (installe) return;
  installe = true;

  const g = globalThis as any;

  /**
   * SUR LE WEB, NE RIEN FAIRE.
   *
   * React Native Web sert l'app dans un navigateur : `window` y est le vrai,
   * avec un vrai `addEventListener`, un vrai `matchMedia` et de vraies
   * dimensions. Poser nos versions par-dessus remplacerait des APIs qui
   * marchent par des coquilles inertes — le moteur cesserait de recevoir
   * 'resize', et `matchMedia` repondrait a l'estime au lieu de lire le CSS.
   *
   * Cet adaptateur n'existe que pour les plateformes qui n'ont pas de DOM.
   */
  if (Platform.OS === 'web') return;

  // Les ecouteurs de `window`. En natif, 'resize' est emis par nos soins
  // (voir plus bas) ; 'pointerup', 'pointercancel' et 'blur' n'arrivent
  // jamais — PanZoomGestures s'en sert pour rattraper un geste qui finit
  // hors du canvas, ce qui n'existe pas ici. Les enregistrer sans jamais
  // les declencher est le comportement correct, pas un trou.
  const ecouteurs = new Map<string, Set<Ecouteur>>();

  const addEventListener = (type: string, cb: Ecouteur) => {
    if (!ecouteurs.has(type)) ecouteurs.set(type, new Set());
    ecouteurs.get(type)!.add(cb);
  };
  const removeEventListener = (type: string, cb: Ecouteur) => {
    ecouteurs.get(type)?.delete(cb);
  };
  const emettre = (type: string, e: any = {}) => {
    for (const cb of ecouteurs.get(type) ?? []) {
      try { cb(e); } catch { /* un ecouteur casse n'en tue pas un autre */ }
    }
  };

  const { width, height } = Dimensions.get('window');

  const faux = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: PixelRatio.get(),
    addEventListener,
    removeEventListener,
    /**
     * Les requetes media du moteur sont toutes des preferences ou des
     * capacites d'entree :
     *   (prefers-reduced-motion: reduce)   -> l'accessibilite du systeme
     *   (hover: none) and (pointer: coarse) -> vrai sur un telephone
     *   l'orientation (PORTRAIT_GATE_QUERY) -> on lit Dimensions
     */
    matchMedia: (q: string) => {
      const d = Dimensions.get('window');
      let matches = false;
      if (/hover:\s*none|pointer:\s*coarse/.test(q)) matches = true;
      else if (/orientation:\s*portrait/.test(q)) matches = d.height >= d.width;
      else if (/orientation:\s*landscape/.test(q)) matches = d.width > d.height;
      else if (/max-width:\s*(\d+)/.test(q)) {
        matches = d.width <= Number(RegExp.$1);
      }
      // prefers-reduced-motion : non branche sur l'accessibilite systeme pour
      // l'instant. false = les animations jouent, ce qui est le defaut du web.
      return { matches, media: q, addListener() {}, removeListener() {},
               addEventListener() {}, removeEventListener() {} };
    },
    setTimeout: g.setTimeout.bind(g),
    clearTimeout: g.clearTimeout.bind(g),
  };

  // Hors web, `window` n'existe pas : on le pose entier.
  g.window = faux;

  // Les dimensions changent a la rotation. Le moteur ecoute 'resize' pour
  // resoudre a nouveau ses cadrages (BurrowScene.onResize), donc on relaie.
  Dimensions.addEventListener('change', ({ window: w }) => {
    g.window.innerWidth = w.width;
    g.window.innerHeight = w.height;
    emettre('resize', {});
  });
}
