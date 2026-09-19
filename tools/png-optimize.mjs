/**
 * Recompresse les .png de public/assets sans perte.
 *
 * `sips` (qui fait la conversion webp -> png) n'optimise rien : il ecrit des
 * PNG 24/32 bits non quantifies. Pour du pixel art a palette reduite, une
 * recompression sans perte divise le poids par 2 a 5.
 *
 *   bun run tools/png-optimize.mjs
 */
import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const RACINE = 'public/assets';

async function* parcourir(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* parcourir(p);
    else if (extname(e.name).toLowerCase() === '.png') yield p;
  }
}

let avant = 0, apres = 0, n = 0;

for await (const src of parcourir(RACINE)) {
  const tailleAvant = (await stat(src)).size;
  const tmp = `${src}.tmp`;
  try {
    // palette: true quantifie sans perte visible sur du pixel art.
    await sharp(src).png({ compressionLevel: 9, palette: true, effort: 10 }).toFile(tmp);
    const tailleApres = (await stat(tmp)).size;
    if (tailleApres < tailleAvant) {
      await rename(tmp, src);
      apres += tailleApres;
    } else {
      await unlink(tmp);
      apres += tailleAvant;
    }
    avant += tailleAvant;
    n++;
  } catch (e) {
    await unlink(tmp).catch(() => {});
    console.warn(`echec ${src}: ${e.message}`);
  }
}

const mo = (x) => (x / 1024 / 1024).toFixed(1);
console.log(`${n} png : ${mo(avant)} Mo -> ${mo(apres)} Mo`);
