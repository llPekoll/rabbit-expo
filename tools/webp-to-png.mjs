/**
 * Convertit les .webp de public/assets en .png a cote.
 *
 * Raison : expo-gl decode ses textures avec stb_image
 * (expo-gl/common/EXGLImageUtils.cpp), qui gere JPEG/PNG/BMP/GIF/HDR/PIC/PNM
 * mais PAS le WebP. Un .webp donne une texture vide, sans erreur GL.
 *
 * Les .webp restent en place : le jeu web continue de les servir pendant la
 * migration. Le natif, lui, ne reference que les .png.
 *
 *   node tools/webp-to-png.mjs [--force]
 */
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const RACINE = 'public/assets';
const force = process.argv.includes('--force');

async function* parcourir(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* parcourir(p);
    else if (extname(e.name).toLowerCase() === '.webp') yield p;
  }
}

let convertis = 0, ignores = 0, poidsWebp = 0, poidsPng = 0;

for await (const src of parcourir(RACINE)) {
  const dest = src.replace(/\.webp$/i, '.png');
  poidsWebp += (await stat(src)).size;
  if (existsSync(dest) && !force) {
    poidsPng += (await stat(dest)).size;
    ignores++;
    continue;
  }
  // sips est livre avec macOS et lit le WebP depuis Ventura.
  await run('sips', ['-s', 'format', 'png', src, '--out', dest]);
  poidsPng += (await stat(dest)).size;
  convertis++;
}

const mo = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`converti ${convertis}, deja present ${ignores}`);
console.log(`webp ${mo(poidsWebp)} Mo -> png ${mo(poidsPng)} Mo (x${(poidsPng / poidsWebp).toFixed(1)})`);
