/**
 * Le terrier, en natif.
 *
 * Monte `BurrowScene` — 2 543 lignes du moteur, importees TELLES QUELLES
 * depuis rabbit-royale — sur le renderer Pixi natif.
 *
 * CE QUE LA SCENE DEMANDE, et rien de plus :
 *  - `app.screen` et `app.canvas` (verifie : ce sont ses deux SEULS usages
 *    de l'application Pixi) ;
 *  - `window.addEventListener('resize')`, fourni par `dom-moteur.ts` ;
 *  - les textures, via le registre natif (`pixi-rn-assets.ts`).
 *
 * L'ESPACE DE DESIGN est celui d'Application.resize() : 960x540 en paysage,
 * 480x860 en portrait, mis a l'echelle uniformement et centre. La scene
 * resout ses cadrages contre GAME_W/GAME_H, donc les respecter n'est pas
 * cosmetique — un mauvais espace et la camera cadre a cote.
 */
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Container } from 'pixi.js';

import { PixiSurface, type ContexteJeu } from './PixiSurface';
// Le moteur passe par ce module : il installe le DOM avant de l'importer.
import { BurrowScene, loadAllAssets, PORTRAIT_W, PORTRAIT_H, landscapeCanvas } from './moteur';



export type BurrowSurfaceProps = {
  /** La graine du terrier : l'id du joueur dont c'est le sol. */
  seed: string;
  /** Le niveau du terrier, qui decide du batiment pose dessus. */
  level?: number | null;
  onErreur?: (message: string) => void;
};

export function BurrowSurface({ seed, level, onErreur }: BurrowSurfaceProps) {
  const scene = useRef<any>(null);

  const onPret = useCallback(async ({ renderer, stage }: ContexteJeu) => {
    try {
      console.log('[RR-BURROW] chargement des assets...');
      let dernier = -1;
      await loadAllAssets((p) => {
        const pct = Math.round(p * 100);
        // Un log par decile : la progression sert a voir OU ca bloque, pas a
        // remplir le journal.
        if (pct >= dernier + 10) {
          dernier = pct;
          console.log(`[RR-BURROW] assets ${pct}%`);
        }
      });
      console.log('[RR-BURROW] assets prets');

      // L'espace de design, comme Application.resize() le calcule.
      const { width: w, height: h } = renderer;
      const portrait = h > w;
      const gw = portrait ? PORTRAIT_W : landscapeCanvas(w, h).w;
      const gh = portrait ? PORTRAIT_H : landscapeCanvas(w, h).h;

      // La racine mise a l'echelle : le moteur dessine en unites de design,
      // cette couche les amene a la taille de l'ecran.
      const racine = new Container();
      const echelle = Math.min(w / gw, h / gh);
      racine.scale.set(echelle);
      racine.position.set(Math.round((w - gw * echelle) / 2), 0);
      stage.addChild(racine);

      // `app` minimal : la scene ne lit que screen et canvas.
      const faussApp: any = {
        screen: { width: gw, height: gh, x: 0, y: 0 },
        canvas: {
          width: w, height: h, style: {},
          addEventListener() {}, removeEventListener() {},
          getBoundingClientRect: () => ({ x: 0, y: 0, width: w, height: h, top: 0, left: 0 }),
        },
        renderer,
        stage: racine,
      };

      const s = new BurrowScene(faussApp, null as any);
      s.init({ seed, level: level ?? 1, traps: [] } as any);
      await s.create();
      racine.addChild(s.container);
      scene.current = s;

      console.log('[RR-BURROW] terrier monte');
    } catch (e: any) {
      console.log(`[RR-BURROW] ECHEC ${e?.name}: ${e?.message}`);
      console.log(String(e?.stack).split('\n').slice(0, 8).join(' | '));
      onErreur?.(e?.message ?? 'le terrier n\'a pas pu s\'ouvrir');
    }
  }, [seed, level, onErreur]);

  const onFrame = useCallback((dt: number) => {
    // La scene attend un delta en FRAMES (base 60), comme le ticker de Pixi.
    scene.current?.update?.(dt * 60);
  }, []);

  return (
    <View style={styles.racine}>
      <PixiSurface onPret={onPret} onFrame={onFrame} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: '#1b2838' },
});
