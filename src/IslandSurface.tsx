/**
 * L'ile, en natif.
 *
 * Monte `IslandScene` — 2 327 lignes du moteur, importees telles quelles.
 * Comme pour le terrier, la scene ne demande que `app.renderer` et
 * `app.canvas` ; tout le reste passe par `dom-moteur.ts`.
 *
 * LES RAMPES. L'ile active `slopes: true` (TerrainBackground.ts), donc elle
 * fabrique ses textures de rampe en manipulant des pixels. Ce travail se
 * faisait par un canvas 2D ; il passe desormais par le renderer
 * (`setSlopeRenderer`, pose dans PixiSurface) — sur le web comme ici.
 *
 * `canvas` est passe a la scene pour qu'elle cadre contre NOTRE espace de
 * design : `Application.resize` ne tourne jamais en natif, donc GAME_W/GAME_H
 * resteraient au 960x540 paysage meme sur un ecran portrait.
 */
import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Container } from 'pixi.js';

import { PixiSurface, type ContexteJeu } from './PixiSurface';
// Le moteur passe par ce module : il installe le DOM avant de l'importer.
import { IslandScene, loadAllAssets, PORTRAIT_W, PORTRAIT_H, landscapeCanvas } from './moteur';


export type IslandSurfaceProps = {
  /** La graine de l'ile : son id cote serveur, d'ou sa cote est taillee. */
  seed: string;
  /** L'id du joueur local, pour distinguer son lapin des autres. */
  playerId: string;
  /** Le joueur veut marcher sur cette case. Le serveur tranche. */
  onMoveIntent?: (index: number) => void;
  onErreur?: (message: string) => void;
};

export function IslandSurface({
  seed, playerId, onMoveIntent, onErreur,
}: IslandSurfaceProps) {
  const scene = useRef<any>(null);

  const onPret = useCallback(async ({ renderer, stage }: ContexteJeu) => {
    try {
      console.log('[RR-ISLAND] chargement des assets...');
      let dernier = -1;
      await loadAllAssets((p) => {
        const pct = Math.round(p * 100);
        if (pct >= dernier + 20) {
          dernier = pct;
          console.log(`[RR-ISLAND] assets ${pct}%`);
        }
      });
      console.log('[RR-ISLAND] assets prets');

      const { width: w, height: h } = renderer;
      const portrait = h > w;
      const gw = portrait ? PORTRAIT_W : landscapeCanvas(w, h).w;
      const gh = portrait ? PORTRAIT_H : landscapeCanvas(w, h).h;

      const racine = new Container();
      const echelle = Math.min(w / gw, h / gh);
      racine.scale.set(echelle);
      racine.position.set(Math.round((w - gw * echelle) / 2), 0);
      stage.addChild(racine);

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

      const s = new IslandScene(faussApp, null as any);
      s.init({
        seed,
        playerId,
        onMoveIntent: (i: number) => onMoveIntent?.(i),
        // L'espace de design, faute d'Application.resize ici.
        canvas: { width: gw, height: gh },
      } as any);
      await s.create();
      racine.addChild(s.container);
      scene.current = s;

      console.log(`[RR-ISLAND] ile montee (${gw}x${gh})`);
    } catch (e: any) {
      console.log(`[RR-ISLAND] ECHEC ${e?.name}: ${e?.message}`);
      console.log(String(e?.stack).split('\n').slice(0, 8).join(' | '));
      onErreur?.(e?.message ?? 'l\'ile n\'a pas pu s\'ouvrir');
    }
  }, [seed, playerId, onMoveIntent, onErreur]);

  const onFrame = useCallback((dt: number) => {
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
