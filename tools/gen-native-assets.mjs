/**
 * Genere native/src/asset-registry.ts : la table qui relie les chemins
 * `/assets/...` du jeu aux `require()` que Metro sait empaqueter.
 *
 * En natif il n'y a pas de serveur de fichiers : une URL ne veut rien dire.
 * Metro veut un `require('...')` LITTERAL a l'analyse statique, donc la table
 * est generee plutot qu'ecrite a la main.
 *
 * Seuls les .png sont recenses : expo-gl decode via stb_image, qui ne gere
 * pas le WebP. `tools/webp-to-png.mjs` produit les .png correspondants.
 *
 *   node tools/gen-native-assets.mjs
 */
import { readdir, writeFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

/**
 * Les assets sont COPIES dans ce projet (assets/game/), pas references chez
 * le voisin : Metro exige des `require()` litteraux, et un chemin `../../`
 * qui sort de la racine du projet est fragile — il a casse une fois de plus
 * qu'il n'a servi. `tools/sync-assets.mjs` les remet a jour depuis le jeu.
 *
 * Le MOTEUR, lui, n'est pas copie : voir metro.config.js. 42 000 lignes en
 * double divergeraient au premier correctif.
 */
const RACINES = ['assets/game', 'assets/kit'];
const SORTIE = 'src/asset-registry.ts';

async function* parcourir(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* parcourir(p);
    else yield p;
  }
}

const entrees = [];
for (const RACINE of RACINES) for await (const f of parcourir(RACINE)) {
  const ext = extname(f).toLowerCase();
  // .png : les textures. .json : les atlas Aseprite, que Pixi lit tels quels.
  if (ext !== '.png' && ext !== '.json') continue;
  // L'URL telle que le jeu l'ecrit ('/assets/...'), et le chemin depuis
  // src/asset-registry.ts.
  // Les assets du jeu gardent l'URL qu'il ecrit ('/assets/...') ; ceux du
  // kit prennent '/kit/...', leur seul role etant d'etre trouvables.
  const prefixe = RACINE.endsWith('kit') ? '/kit/' : '/assets/';
  const url = prefixe + relative(RACINE, f);
  const chemin = '../' + f;
  entrees.push([url, chemin]);
}

entrees.sort((a, b) => a[0].localeCompare(b[0]));

const lignes = entrees
  .map(([url, chemin]) => `  ${JSON.stringify(url)}: require(${JSON.stringify(chemin)}),`)
  .join('\n');

const src = `/**
 * GENERE par tools/gen-native-assets.mjs — ne pas editer a la main.
 *
 * Relie les chemins d'assets du jeu (\`/assets/...\`, tels qu'ecrits dans
 * AssetLoader et les configs) aux modules que Metro empaquette. Metro exige
 * des \`require()\` litteraux : d'ou la generation.
 *
 * ${entrees.length} entrees.
 */

export const ASSETS: Record<string, number> = {
${lignes}
};

/**
 * Le module Metro d'un chemin d'asset, ou null s'il n'est pas empaquete.
 *
 * Tolerant sur la forme du chemin : le Resolver de Pixi retire le slash
 * initial ("/assets/x.png" -> "assets/x.png") et peut prefixer une base URL.
 * On normalise donc avant de chercher, et on retombe sur le .png jumeau
 * quand le jeu reference un .webp (que stb_image ne sait pas decoder).
 */
export function moduleDe(url: string): number | null {
  if (typeof url !== 'string' || url.length === 0) return null;

  // Ne garder que la partie a partir de "/assets/", sans query ni ancre.
  let chemin = url.split('?')[0].split('#')[0];
  const i = chemin.indexOf('assets/');
  if (i === -1) return null;
  chemin = '/' + chemin.slice(i);

  const png = chemin.replace(/\\.webp$/i, '.png');
  return ASSETS[chemin] ?? ASSETS[png] ?? null;
}
`;

await writeFile(SORTIE, src);
console.log(`${entrees.length} assets -> ${SORTIE}`);
