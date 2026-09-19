/**
 * Adaptateur d'environnement Pixi v8 pour React Native / expo-gl.
 *
 * Pixi centralise TOUS ses appels DOM dans l'interface `Adapter`
 * (cf. node_modules/pixi.js/lib/environment/adapter.d.ts). On en fournit
 * une implementation sans DOM, sur le modele du WebWorkerAdapter officiel.
 *
 * Point cle : `createCanvas` ne sert qu'aux SONDES de capacite GPU
 * (getTestContext -> getShaderPrecisionFormat / MAX_TEXTURE_IMAGE_UNITS).
 * Le contexte de rendu reel est celui d'expo-gl, passe a `app.init({ context })`.
 */

type GL = any;

/** Le contexte expo-gl courant, partage avec les sondes de Pixi. */
let sharedGL: GL = null;

export function setSharedGL(gl: GL) {
  sharedGL = gl;
}

/**
 * Faux canvas.
 *
 * Deux usages chez Pixi :
 *  1. les SONDES de capacite GPU (getTestContext) -> getContext('webgl')
 *  2. la "vue" du renderer (ViewSystem -> CanvasSource), qui lit
 *     width/height/style et peut demander un contexte 2d.
 *
 * On couvre les deux : dimensions par defaut plausibles, style mutable,
 * et un contexte 2d inerte plutot que null (CanvasSource le dereference).
 */
function createFakeCanvas(width = 1, height = 1) {
  const canvas: any = {
    width,
    height,
    style: {},
    getContext(type: string) {
      // Les sondes demandent 'webgl' / 'webgl2' : on rend le contexte expo-gl.
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return sharedGL;
      }
      if (type === '2d') {
        // Contexte 2d inerte : CanvasSource y accede, mais on ne dessine
        // jamais en 2d sur mobile (le rendu passe par GL).
        return {
          canvas,
          fillRect() {}, clearRect() {}, drawImage() {},
          getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
          putImageData() {}, save() {}, restore() {}, scale() {}, translate() {},
          measureText: () => ({ width: 0 }),
          fillText() {}, setTransform() {},
        } as any;
      }
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width, height, top: 0, left: 0 }),
    toDataURL: () => '',
  };
  return canvas;
}

export const ReactNativeAdapter = {
  createCanvas: (width?: number, height?: number) => createFakeCanvas(width, height),

  createImage: () => {
    // RN n'a pas HTMLImageElement ; les textures passeront par expo-asset.
    const img: any = { width: 0, height: 0, src: '', complete: false };
    return img;
  },

  getCanvasRenderingContext2D: () => (({}) as any),

  getWebGLRenderingContext: () => {
    /**
     * Pixi s'en sert UNIQUEMENT pour deduire la version :
     *   webGLVersion = gl instanceof getWebGLRenderingContext() ? 1 : 2
     * (GlContextSystem.mjs:98)
     *
     * expo-gl fournit un contexte WebGL2, mais il herite souvent de
     * WebGLRenderingContext : rendre ce global ferait conclure "WebGL1" a
     * tort, et Pixi refuserait alors les Vertex Array Objects.
     *
     * On rend donc une classe dont le contexte expo-gl n'est jamais une
     * instance : le instanceof est faux, Pixi retient la version 2, et les
     * VAO natifs de WebGL2 sont acceptes.
     */
    return class NeverMatchesExpoGLContext {} as any;
  },

  getNavigator: () => ({
    userAgent: 'react-native',
    gpu: (globalThis as any).navigator?.gpu ?? null,
  }),

  getBaseUrl: () => '',

  getFontFaceSet: () => null,

  fetch: (url: any, options?: any) => fetch(url, options),

  parseXML: (_xml: string) => {
    // Utile seulement pour les BitmapFont XML ; on verra si le jeu en a besoin.
    throw new Error('parseXML non implemente dans ReactNativeAdapter');
  },
} as any;
