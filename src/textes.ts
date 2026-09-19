/**
 * Les textes de l'app native, dans les quatre langues du jeu.
 *
 * Les dictionnaires (`src/i18n/dict/*`) sont repris tels quels du repo du
 * jeu : une seule source, partagee avec le serveur. Seul le PROVIDER du web
 * est laisse de cote (`src/i18n/provider.tsx`), parce qu'il lit
 * `window.localStorage` et `navigator.languages`, absents en React Native.
 *
 * LA FACE PIXEL NE SUIT PAS. L'atlas du kit couvre l'ASCII 32-126 et rien
 * d'autre : un "é", un "ã" ou un sinogramme y sont des blancs (voir
 * i18n/locales.ts). L'anglais garde donc la face bitmap ; les trois autres
 * tombent sur la police systeme. `pixelFace` de `LOCALE_META` dit laquelle.
 */
import { en } from '../jeu/src/i18n/dict/en';
import { fr } from '../jeu/src/i18n/dict/fr';
import { zh } from '../jeu/src/i18n/dict/zh';
import { ptBR } from '../jeu/src/i18n/dict/pt-BR';
import { LOCALES, DEFAULT_LOCALE, type Locale } from '../jeu/src/i18n/locales';

export type { Locale };
export { LOCALES, DEFAULT_LOCALE };

export const DICTS = { en, fr, zh, 'pt-BR': ptBR } as const;

export function dict(locale: Locale) {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}
