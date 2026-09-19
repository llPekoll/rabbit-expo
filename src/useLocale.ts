/**
 * La langue choisie, retenue d'une session a l'autre.
 *
 * Le web garde ce choix dans `localStorage` (i18n/provider.tsx). Ici il va
 * dans AsyncStorage : ce n'est pas un secret, il n'a rien a faire dans le
 * trousseau (reserve au jeton de session, cf. session.ts).
 *
 * A defaut de choix enregistre, on suit la langue de l'appareil quand le jeu
 * la parle, sinon l'anglais.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import { DEFAULT_LOCALE, LOCALES, type Locale } from './textes';

const CLE = 'rr_locale';

function estLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v);
}

/** La langue de l'appareil, si le jeu la parle. */
function langueAppareil(): Locale {
  for (const l of getLocales()) {
    // "pt-BR" d'abord (tag complet), puis "fr" (code seul).
    const tag = l.languageTag;
    if (estLocale(tag)) return tag;
    const code = l.languageCode ?? '';
    if (estLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

export function useLocale() {
  const [locale, setLocaleEtat] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const sauve = await AsyncStorage.getItem(CLE);
        if (vivant && estLocale(sauve)) {
          setLocaleEtat(sauve);
          return;
        }
      } catch {
        // Stockage indisponible : on retombe sur la langue de l'appareil.
      }
      if (vivant) setLocaleEtat(langueAppareil());
    })();
    return () => { vivant = false; };
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleEtat(l);
    void AsyncStorage.setItem(CLE, l).catch(() => {});
  }, []);

  return { locale, setLocale };
}
