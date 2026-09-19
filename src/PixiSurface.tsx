/**
 * La surface Pixi native : une GLView qui monte un WebGLRenderer.
 *
 * Les regles apprises dans expo-pixi-test/TROUVAILLES.md sont appliquees ici,
 * dans l'ordre qui compte :
 *  1. DOMAdapter.set() AVANT toute creation Pixi ;
 *  2. WebGLRenderer directement — jamais Application (ResizePlugin appelle
 *     globalThis.removeEventListener, absent en RN) ;
 *  3. skipExtensionImports, et les systemes enregistres a la main ;
 *  4. la boucle sur requestAnimationFrame + gl.endFrameEXP().
 */
import { useCallback, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GLView } from 'expo-gl';
import { Container, DOMAdapter, WebGLRenderer } from 'pixi.js';

import { ReactNativeAdapter, setSharedGL } from './pixi-rn-adapter';
import './pixi-rn-init';
import { initAssetsRN, installerLoaderRN } from './pixi-rn-assets';

export type ContexteJeu = {
  renderer: WebGLRenderer;
  stage: Container;
  largeur: number;
  hauteur: number;
};

type Props = {
  /** Appele une fois le renderer pret : c'est la que la scene se monte. */
  onPret: (ctx: ContexteJeu) => void | Promise<void>;
  /** Appele a chaque frame, avant le rendu. */
  onFrame?: (dt: number) => void;
  style?: ViewStyle;
};

export function PixiSurface({ onPret, onFrame, style }: Props) {
  const vivant = useRef(true);

  const onContextCreate = useCallback(
    async (gl: any) => {
      // 1. L'adaptateur sans DOM, avant tout objet Pixi.
      setSharedGL(gl);
      DOMAdapter.set(ReactNativeAdapter);

      // 2. Le renderer seul, sans les plugins web d'Application.
      const renderer = new WebGLRenderer();
      await renderer.init({
        context: gl,
        width: gl.drawingBufferWidth,
        height: gl.drawingBufferHeight,
        backgroundColor: 0x1b2838,
        antialias: false,
        skipExtensionImports: true,
      });

      // 3. Les assets : registre natif + copie vers le cache (mur 9).
      initAssetsRN(gl, renderer);
      installerLoaderRN();

      const stage = new Container();

      await onPret({
        renderer,
        stage,
        largeur: renderer.width,
        hauteur: renderer.height,
      });

      // 4. La boucle : rAF, puis endFrameEXP pour presenter la frame.
      let precedent = Date.now();
      const boucle = () => {
        if (!vivant.current) return;
        const maintenant = Date.now();
        onFrame?.((maintenant - precedent) / 1000);
        precedent = maintenant;
        renderer.render(stage);
        gl.endFrameEXP();
        requestAnimationFrame(boucle);
      };
      requestAnimationFrame(boucle);
    },
    [onPret, onFrame],
  );

  return (
    <View style={[styles.racine, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: '#1b2838' },
});
