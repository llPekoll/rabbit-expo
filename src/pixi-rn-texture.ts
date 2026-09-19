/**
 * Chargement de textures Pixi v8 en React Native.
 *
 * Pixi web fait : new Image() -> img.src -> texImage2D(img).
 * En RN il n'y a pas de HTMLImageElement. On passe donc par expo-asset
 * (decodage natif), on televerse dans une texture GL a la main, puis on
 * confie cette texture a `ExternalSource` — la source Pixi prevue pour une
 * ressource GPU appartenant a du code externe.
 *
 * Note : l'uploader d'images classiques de Pixi n'utilise PAS pixelStorei
 * (seul celui des textures compressees KTX/DDS le fait), donc le
 * "EXGL: pixelStorei() doesn't support this parameter yet!" vu dans les logs
 * ne concerne pas ce chemin.
 */
import { Asset } from 'expo-asset';

type GL = any;

export type TextureChargee = {
  texture: any;
  largeur: number;
  hauteur: number;
  notes: string[];
};

export async function chargerTexture(
  PIXI: any,
  renderer: any,
  moduleAsset: number,
): Promise<TextureChargee> {
  const notes: string[] = [];
  const gl: GL = renderer.gl;

  // 1. expo-asset decode le fichier cote natif.
  const asset = Asset.fromModule(moduleAsset);
  await asset.downloadAsync();
  const largeur = asset.width ?? 1;
  const hauteur = asset.height ?? 1;
  notes.push(`asset ${largeur}x${hauteur} localUri=${!!asset.localUri}`);

  // 2. Televersement GL. expo-gl accepte l'objet Asset comme source
  //    de texImage2D (extension maison EXGL).
  /**
   * On va toucher l'etat GL dans le dos de Pixi. Son GlTextureSystem
   * garde un cache `_boundTextures[unit]` et ne rebinde que si ce cache
   * dit que la texture a change (GlTextureSystem.mjs:95). Si on laisse
   * notre texture liee sur l'unite active sans le lui dire, ses Graphics
   * unis (Texture.WHITE x couleur) echantillonnent NOTRE image a la place
   * du blanc -> tout vire au gris. On sauvegarde donc l'etat, et on
   * invalide le cache de Pixi apres coup.
   */
  // PAS de gl.getParameter(TEXTURE_BINDING_2D / ACTIVE_TEXTURE) : expo-gl
  // ne les implemente pas ("getParameter() doesn't support gl.32873 yet").
  // On n'a pas besoin de restaurer l'etat exact : invalider le cache de
  // Pixi apres coup (resetState) suffit, il rebindera tout au prochain frame.
  gl.activeTexture(gl.TEXTURE0);
  const glTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTex);

  /**
   * expo-gl n'accepte PAS un Asset complet : il attend la forme GLSnapshot,
   * soit { localUri, width, height } (cf. expo-gl/build/GLView.types.d.ts).
   * Passer l'Asset entier televerse une texture vide -> rectangle noir.
   */
  /**
   * Contraintes de l'implementation NATIVE d'expo-gl
   * (common/EXGLImageUtils.cpp, fonction loadImage) :
   *   1. la propriete `localUri` doit commencer par "file://",
   *      sinon retour nullptr SILENCIEUX -> texture grise ;
   *   2. le decodage passe par stbi_load (stb_image), qui gere
   *      JPEG/PNG/BMP/GIF/HDR/PIC/PNM — **pas le WebP**.
   * D'ou l'obligation de convertir les assets .webp du jeu en .png.
   */
  const uri = asset.localUri ?? asset.uri ?? '';
  const source = { localUri: uri, uri, width: largeur, height: hauteur };
  const estFichier = uri.startsWith('file://');
  notes.push(`file://=${estFichier} ...${uri.slice(-24)}`);
  if (!estFichier) {
    notes.push('ATTENTION: loadImage renverra nullptr (uri non file://)');
  }

  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as any,
  );
  const errUpload = gl.getError?.();
  notes.push(`glError apres upload=${errUpload ?? 'n/a'}`);

  /**
   * PAS de sonde par framebuffer ici.
   *
   * expo-gl ne dessine pas dans le framebuffer 0 mais dans le sien
   * ("underlying framebuffer that is presented in the view", cf.
   * GLView.types.d.ts). Un bindFramebuffer(FRAMEBUFFER, null) redirige donc
   * tout le rendu suivant vers un framebuffer invisible : l'ecran devient
   * noir apres le premier frame. C'est exactement le symptome observe
   * (carre rose une fraction de seconde, puis noir).
   *
   * Si une verification de pixels est necessaire, il faut sauvegarder le
   * framebuffer courant (gl.getParameter(gl.FRAMEBUFFER_BINDING)) et le
   * rebinder, jamais passer null.
   */

  // Restauration de l'etat GL + invalidation du cache de liaison de Pixi,
  // pour qu'au prochain frame il rebinde reellement ce qu'il croit lie.
  gl.bindTexture(gl.TEXTURE_2D, null);
  renderer.texture?.resetState?.();
  notes.push('cache liaisons Pixi invalide');

  // 3. ExternalSource : Pixi adopte une texture GPU qu'il n'a pas creee.
  const pixiSource = new PIXI.ExternalSource({
    resource: glTex,
    renderer,
    width: largeur,
    height: hauteur,
    label: 'rn-texture',
  });
  pixiSource.scaleMode = 'nearest';

  return { texture: new PIXI.Texture({ source: pixiSource }), largeur, hauteur, notes };
}

/**
 * Televersement de pixels BRUTS (signature texImage2D a 9 args, Uint8Array).
 * Contourne totalement loadImage/stb_image : sert a departager
 * "le decodeur natif echoue" de "Pixi n'echantillonne pas la texture".
 */
export function chargerTextureBrute(
  PIXI: any,
  renderer: any,
  largeur: number,
  hauteur: number,
  pixels: Uint8Array,
): TextureChargee {
  const gl: GL = renderer.gl;
  const notes: string[] = [];

  gl.activeTexture(gl.TEXTURE0);
  const glTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, largeur, hauteur, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);
  notes.push(`glError=${gl.getError?.()}`);
  gl.bindTexture(gl.TEXTURE_2D, null);
  renderer.texture?.resetState?.();

  const pixiSource = new PIXI.ExternalSource({
    resource: glTex, renderer, width: largeur, height: hauteur, label: 'rn-brute',
  });
  pixiSource.scaleMode = 'nearest';
  return { texture: new PIXI.Texture({ source: pixiSource }), largeur, hauteur, notes };
}


/**
 * Meme chemin que chargerTexture (texImage2D 6 args -> loadImage -> stbi_load),
 * mais a partir d'une URI file:// que l'on maitrise : sert a tester le
 * decodeur natif avec un fichier dont on connait exactement les octets.
 */
export function chargerTextureDepuisUri(
  PIXI: any, renderer: any, uri: string, largeur: number, hauteur: number,
): TextureChargee {
  const gl: GL = renderer.gl;
  const notes: string[] = [];
  gl.activeTexture(gl.TEXTURE0);
  const glTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
    { localUri: uri, uri, width: largeur, height: hauteur } as any,
  );
  notes.push(`glError=${gl.getError?.()}`);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  renderer.texture?.resetState?.();
  const pixiSource = new PIXI.ExternalSource({
    resource: glTex, renderer, width: largeur, height: hauteur, label: 'rn-uri',
  });
  pixiSource.scaleMode = 'nearest';
  return { texture: new PIXI.Texture({ source: pixiSource }), largeur, hauteur, notes };
}
