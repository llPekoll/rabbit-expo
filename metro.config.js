/**
 * Metro pour l'app native de Rabbit Royale.
 *
 * LE MOTEUR N'EST PAS COPIE. `jeu/src` et `jeu/config` sont deux LIENS
 * SYMBOLIQUES vers ../rabbit-royale : le code l'importe par des chemins
 * relatifs ordinaires (`../jeu/src/game/...`), donc Metro n'a aucun alias a
 * resoudre. Une seule source pour les ~42 000 lignes de moteur, partagee avec
 * le web et le serveur.
 *
 * POURQUOI PAS D'ALIAS. Ni `resolver.alias` ni `resolver.resolveRequest` ne
 * sont consultes pour les imports DYNAMIQUES : Metro garde alors le chemin
 * tel quel dans le bundle et le runtime le resout depuis la racine du projet,
 * perdant le `..` — d'ou "Unable to resolve module ./rabbit-royale/src/...".
 * Les liens suppriment le probleme au lieu de le contourner.
 *
 * LES ASSETS, eux, SONT copies (assets/game/, voir tools/sync-assets.mjs) :
 * Metro exige des `require()` litteraux, et un chemin qui sort de la racine
 * du projet a casse plus souvent qu'il n'a servi.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Le moteur est lu a travers jeu/src -> ../rabbit-royale/src.
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
