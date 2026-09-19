/**
 * Recopie les assets du jeu dans ce projet, puis regenere le registre.
 *
 *   bun run assets
 *
 * POURQUOI COPIER. Metro exige des `require()` LITTERAUX, et un chemin qui
 * remonte hors de la racine du projet (`../../rabbit-royale/...`) est fragile.
 * Les assets changent rarement ; les copier coute 12 Mo et supprime une
 * classe entiere de pannes.
 *
 * Le MOTEUR, lui, n'est pas copie (voir metro.config.js) : 42 000 lignes en
 * double divergeraient au premier correctif.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SOURCE = '../rabbit-royale/public/assets/';
const CIBLE = 'assets/game/';

// --delete : un asset retire du jeu disparait aussi d'ici.
await run('rsync', ['-a', '--delete', '--exclude=.DS_Store', SOURCE, CIBLE]);
const { stdout } = await run('bash', ['-c', `find ${CIBLE} -type f | wc -l`]);
console.log(`${stdout.trim()} assets synchronises`);

await run('node', ['tools/gen-native-assets.mjs']).then(({ stdout }) =>
  process.stdout.write(stdout),
);
