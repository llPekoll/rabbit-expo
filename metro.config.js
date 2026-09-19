/**
 * Metro pour l'app Expo de Rabbit Royale.
 *
 * Le moteur du jeu (src/game, src/lib, src/config, src/i18n : ~42 000 lignes)
 * n'est PAS copie ici : Metro le lit directement dans ../rabbit-royale. Une
 * seule source, donc pas de divergence quand un bug est corrige d'un cote.
 *
 * Deux reglages necessaires pour ca :
 *  - `watchFolders` : Metro refuse de servir un fichier hors de sa racine ;
 *  - `nodeModulesPaths` : les imports du jeu (pixi.js, le kit) se resolvent
 *    depuis NOS node_modules, pas ceux du repo web.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const ICI = __dirname;
const JEU = path.resolve(ICI, '../rabbit-royale');

const config = getDefaultConfig(ICI);

// Le repo du jeu, pour que Metro accepte d'en lire les fichiers.
config.watchFolders = [JEU];

config.resolver.nodeModulesPaths = [
  path.resolve(ICI, 'node_modules'),
  path.resolve(JEU, 'node_modules'),
];

/**
 * Les alias du tsconfig du jeu (`@/*`, `@config/*`).
 *
 * `resolver.alias` ne couvre PAS les imports dynamiques : un
 * `await import('@/game/Application')` echoue avec "Unable to resolve module"
 * alors que le meme chemin en import statique passe. `resolveRequest` est
 * consulte pour les deux, d'ou cette forme.
 */
const ALIAS = [
  ['@config/', path.resolve(JEU, 'config') + '/'],
  ['@/', path.resolve(JEU, 'src') + '/'],
];

const resolveurParDefaut = config.resolver.resolveRequest;

config.resolver.resolveRequest = (contexte, nomModule, plateforme) => {
  for (const [prefixe, cible] of ALIAS) {
    if (nomModule.startsWith(prefixe)) {
      return contexte.resolveRequest(
        contexte,
        cible + nomModule.slice(prefixe.length),
        plateforme,
      );
    }
  }
  return (resolveurParDefaut ?? contexte.resolveRequest)(contexte, nomModule, plateforme);
};

// `.png` uniquement : expo-gl decode via stb_image, qui ne gere pas le WebP.
module.exports = config;
