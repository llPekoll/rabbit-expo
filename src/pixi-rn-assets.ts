/**
 * Branche le registre d'assets natif dans le systeme `Assets` de Pixi.
 *
 * Le jeu appelle `Assets.add({ alias, src: '/assets/...' })` puis
 * `Assets.load(alias)` — une centaine de fois, dans AssetLoader et les
 * configs. En natif ces URLs ne designent rien : il n'y a pas de serveur de
 * fichiers. On installe donc un *loader* Pixi qui intercepte ces chemins et
 * les resout via `asset-registry.ts` (genere) + expo-asset.
 *
 * Aucun appel du jeu n'est modifie.
 */
import { Assets, ExternalSource, Texture, type LoaderParser } from 'pixi.js';
import { Asset } from 'expo-asset';
import * as FS from 'expo-file-system/legacy';

import { moduleDe } from './asset-registry';

type GL = any;

let gl: GL = null;
let renderer: any = null;

/** Donne au chargeur le contexte GL et le renderer, avant tout Assets.load. */
export function initAssetsRN(contexteGL: GL, rendererPixi: any) {
  gl = contexteGL;
  renderer = rendererPixi;
}

/**
 * Copie l'asset dans le cache et rend une URI que le C++ d'expo-gl sait
 * ouvrir.
 *
 * Pourquoi la copie : une texture chargee directement depuis
 * `asset.localUri` sort NOIRE. Le fichier est pourtant valide (bons octets,
 * bonne taille, lisible par expo-file-system) — c'est la chaine d'URI que
 * `loadImage` (expo-gl/common/EXGLImageUtils.cpp) ne resout pas : elle fait
 * `decodeURI` puis `fopen`, et le dossier d'Expo Go contient des `%40`
 * litteraux. Les memes octets copies dans `cacheDirectory` s'affichent.
 */
async function uriLisible(moduleAsset: number): Promise<{ uri: string; w: number; h: number }> {
  const asset = Asset.fromModule(moduleAsset);
  await asset.downloadAsync();
  const source = asset.localUri ?? asset.uri;
  const w = asset.width ?? 1;
  const h = asset.height ?? 1;

  // Un nom stable par asset : la copie ne se refait pas a chaque lancement.
  const dest = `${FS.cacheDirectory}rr-${asset.hash ?? asset.name}.png`;
  const info = await FS.getInfoAsync(dest);
  if (!info.exists) {
    await FS.copyAsync({ from: source, to: dest });
  }
  return { uri: dest, w, h };
}

/** Televerse le fichier dans une texture GL, puis l'emballe pour Pixi. */
async function textureDepuisModule(moduleAsset: number): Promise<Texture> {
  const { uri, w, h } = await uriLisible(moduleAsset);

  gl.activeTexture(gl.TEXTURE0);
  const glTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
    { localUri: uri, uri, width: w, height: h } as any,
  );
  // Pixel art : pas de lissage, et pas de mipmaps.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);

  // On a bind dans le dos de Pixi : son cache de liaisons croit autre chose.
  gl.bindTexture(gl.TEXTURE_2D, null);
  renderer.texture?.resetState?.();

  const src = new ExternalSource({
    resource: glTex, renderer, width: w, height: h, label: uri,
  });
  src.scaleMode = 'nearest';
  return new Texture({ source: src });
}

/**
 * Le loader Pixi pour les chemins d'assets du jeu.
 * Priorite haute pour passer devant le loader d'images du navigateur.
 */
const loaderRN: LoaderParser = {
  id: 'rabbit-royale-native',
  name: 'rabbit-royale-native',
  extension: { type: 'load-parser' as any, priority: 10 },

  test(url: string) {
    const ok = typeof url === 'string' && moduleDe(url) !== null;
    console.log(`[RR-ASSETS] test("${url}") -> ${ok}`);
    return ok;
  },

  async load(url: string) {
    console.log(`[RR-ASSETS] load("${url}")`);
    const mod = moduleDe(url);
    if (mod === null) throw new Error(`asset absent du registre natif : ${url}`);
    try {
      const t = await textureDepuisModule(mod);
      console.log(`[RR-ASSETS] OK ${url} -> ${t.width}x${t.height}`);
      return t;
    } catch (e: any) {
      console.log(`[RR-ASSETS] ECHEC ${url} :: ${e?.name}: ${e?.message}`);
      console.log(String(e?.stack).split('\n').slice(0, 5).join(' | '));
      throw e;
    }
  },
};

let installe = false;

/** A appeler une fois, avant le premier Assets.load du jeu. */
export function installerLoaderRN() {
  if (installe) return;
  /**
   * En TETE de liste, pas a la fin.
   *
   * Loader._loadResource prend le PREMIER parser dont `test()` repond vrai
   * (Loader.mjs:76-82). Le `loadTextures` de Pixi accepte n'importe quel
   * `.png` et tente ensuite un `new Image()` — inexistant en React Native,
   * d'ou une promesse qui ne se resout jamais. Le notre doit donc passer
   * avant lui.
   */
  Assets.loader.parsers.unshift(loaderRN as any);
  installe = true;
  const noms = Assets.loader.parsers.map((p: any) => p.name ?? p.id).join(', ');
  console.log(`[RR-ASSETS] parsers installes: ${noms}`);
}
