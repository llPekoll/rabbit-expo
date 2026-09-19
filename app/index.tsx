/**
 * La porte d'entree, en natif.
 *
 * Reprend l'ecran de `src/app/page.tsx` (le bloc `.rr-empty`) : le crawl du
 * codex qui monte derriere, le wordmark en masthead, deux boutons, et la
 * langue sous eux.
 *
 * L'ORDRE DES BOUTONS est celui du web, et il est delibere : le wallet mene,
 * l'invite suit. Une signature est un prix eleve pour un jeu qu'on n'a pas
 * encore essaye — mais le wallet est la porte principale.
 *
 * CONNECT WALLET n'est pas encore branche : le Mobile Wallet Adapter viendra
 * ensuite. Il le DIT, plutot que de ne rien faire quand on le presse.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { useSession } from '../src/useSession';
import { useLocale } from '../src/useLocale';
import { dict } from '../src/textes';
import { LoreCrawl } from '../src/LoreCrawl';
import { LanguePicker } from '../src/LanguePicker';
import { BurrowSurface } from '../src/BurrowSurface';
import { IslandSurface } from '../src/IslandSurface';

// Par le registre, comme tout le reste : `assets/game/` est la copie locale
// des assets du jeu (voir tools/sync-assets.mjs).
const LOGO = require('../assets/game/ui/rr-logo-1x.png');

export default function Porte() {
  const {
    joueur, verification, occupe, erreur,
    jouerEnInvite, connecterWallet, walletPossible, raisonWallet, deconnecter,
  } = useSession();
  const { locale, setLocale } = useLocale();
  const t = dict(locale);

  const surInvite = useCallback(() => { void jouerEnInvite(); }, [jouerEnInvite]);
  // Quelle scene est a l'ecran. Le jeu enchaine terrier -> ile ; ici on
  // bascule a la main, le temps de valider les deux.
  const [scene, setScene] = useState<'terrier' | 'ile'>('terrier');
  const surWallet = useCallback(() => { void connecterWallet(); }, [connecterWallet]);

  // Session ouverte : le terrier. La graine est l'id du joueur — c'est de
  // lui que son sol est genere (voir game/burrow/board).
  if (joueur) {
    return (
      <View style={styles.racine}>
        <Stack.Screen options={{ headerShown: false }} />
        {scene === 'terrier' ? (
          <BurrowSurface seed={joueur.id} level={1} />
        ) : (
          <IslandSurface seed={`ile-${joueur.id}`} playerId={joueur.id} />
        )}
        {/* Le chrome, au-dessus du canvas. Reduit au strict minimum pour
            l'instant : de quoi savoir qui joue et pouvoir ressortir. */}
        <SafeAreaView style={styles.chrome} pointerEvents="box-none">
          <View style={styles.barre} pointerEvents="box-none">
            <Text style={styles.nomJoueur}>{joueur.name}</Text>
            <View style={styles.actions}>
              <Pressable
                onPress={() => setScene(scene === 'terrier' ? 'ile' : 'terrier')}
                hitSlop={8}
              >
                <Text style={styles.lienScene}>
                  {scene === 'terrier' ? 'voir l\'ile' : 'voir le terrier'}
                </Text>
              </Pressable>
              <Pressable onPress={() => void deconnecter()} hitSlop={8}>
                <Text style={styles.lienDiscretTexte}>{t.profile.disconnect}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.racine}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Derriere tout : l'histoire de l'ile, qui monte. Tenue jusqu'a la fin
          de la verification de session, pour qu'elle demarre a sa premiere
          ligne quand l'ecran s'ouvre plutot qu'a mi-course. */}
      {!verification && <LoreCrawl locale={locale} />}

      <SafeAreaView style={styles.calque}>
        <View style={styles.masthead}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.colonne}>
          {verification ? (
            <ActivityIndicator color="#ff8c42" />
          ) : (
            <>
              {/* LE WALLET MENE, l'invite suit — l'ordre du web, et il est
                  delibere : une signature est un prix eleve pour un jeu qu'on
                  n'a pas essaye, mais le wallet est la porte principale. */}
              <Pressable
                style={({ pressed }) => [
                  styles.bouton, styles.boutonCarotte,
                  pressed && styles.boutonPresse,
                  !walletPossible && styles.boutonInerte,
                ]}
                onPress={surWallet}
                disabled={occupe || !walletPossible}
              >
                <Text style={[styles.label, styles.labelCarotte]}>
                  {occupe ? t.auth.connecting : t.auth.connect}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.bouton, styles.boutonDiscret, pressed && styles.boutonPresse,
                ]}
                onPress={surInvite}
                disabled={occupe}
              >
                <Text style={[styles.label, styles.labelDiscret]}>
                  {occupe ? t.auth.connecting : t.auth.guest}
                </Text>
              </Pressable>

              {/* Hors Android il n'y a pas de wallet a ouvrir : on le dit,
                  plutot que de laisser un bouton qui ne repond pas. */}
              {!walletPossible && raisonWallet && (
                <Text style={styles.note}>{raisonWallet}</Text>
              )}

              {erreur && <Text style={styles.erreur}>{erreur}</Text>}

              <LanguePicker locale={locale} onChange={setLocale} />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: '#0d1117' },
  chrome: { position: 'absolute', top: 0, left: 0, right: 0 },
  barre: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 6,
  },
  nomJoueur: { color: '#e6edf3', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  lienScene: { color: '#ffd45c', fontSize: 12, fontWeight: '700' },
  calque: { flex: 1, justifyContent: 'space-between' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  masthead: { alignItems: 'center', paddingTop: 16 },
  logo: { width: 240, height: 80 },
  colonne: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },

  bouton: {
    height: 52, borderRadius: 4, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 4,
  },
  boutonCarotte: { backgroundColor: '#ff8c42', borderBottomColor: '#a8521c' },
  boutonDiscret: { height: 44, backgroundColor: '#161b22', borderBottomColor: '#0b0f14' },
  boutonInerte: { opacity: 0.4 },
  // Le bouton s'enfonce : la bordure du bas disparait sous lui.
  boutonPresse: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },

  label: { fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  labelCarotte: { color: '#2a1206' },
  labelDiscret: { color: '#b1bac4' },
  note: { color: '#6e7681', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  aVenirBloc: { alignItems: 'center', paddingVertical: 8 },
  aVenirTexte: { color: '#6e7681', fontSize: 12, fontStyle: 'italic' },

  erreur: { color: '#ff7b72', fontSize: 12, textAlign: 'center' },

  bienvenue: { color: '#e6edf3', fontSize: 22, fontWeight: '700' },
  detail: { color: '#8b949e', fontSize: 12 },
  aVenir: { color: '#6e7681', fontSize: 11, fontStyle: 'italic', marginTop: 16 },
  lienDiscret: { marginTop: 24, padding: 8 },
  lienDiscretTexte: { color: '#6e7681', fontSize: 12, textDecorationLine: 'underline' },
});
