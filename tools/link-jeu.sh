#!/usr/bin/env bash
# Relie le moteur du jeu dans ce projet.
#
# `jeu/src` et `jeu/config` sont des LIENS vers ../rabbit-royale : le code les
# importe par des chemins relatifs ordinaires, et Metro n'a aucun alias a
# resoudre (il n'en resout pas dans les imports dynamiques — voir
# metro.config.js).
#
# A relancer apres un clone : les liens ne sont pas versionnes.
set -euo pipefail
JEU="${1:-../rabbit-royale}"
cd "$(dirname "$0")/.."
[ -d "$JEU/src/game" ] || { echo "moteur introuvable dans $JEU" >&2; exit 1; }
mkdir -p jeu
ln -sfn "$(cd "$JEU" && pwd)/src" jeu/src
ln -sfn "$(cd "$JEU" && pwd)/config" jeu/config
echo "jeu/src et jeu/config relies a $(cd "$JEU" && pwd)"
