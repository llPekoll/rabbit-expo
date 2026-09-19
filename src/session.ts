/**
 * Le jeton de session, cote natif.
 *
 * Le web garde le sien dans `localStorage` (voir use-wallet-login.tsx). En
 * React Native il n'y a pas de localStorage, et un JWT de trente jours n'a
 * rien a faire dans un stockage en clair : il va dans le trousseau du
 * systeme (Keychain sur iOS, EncryptedSharedPreferences sur Android).
 *
 * Meme cle que le web (`rr_token`), pour que les deux implementations se
 * lisent pareil quand le site passera sous Expo.
 */
import * as SecureStore from 'expo-secure-store';

const CLE = 'rr_token';

export async function lireJeton(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CLE);
  } catch {
    // Trousseau indisponible (emulateur mal configure, appareil verrouille) :
    // on repart sans session plutot que de planter au demarrage.
    return null;
  }
}

export async function ecrireJeton(jeton: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(CLE, jeton);
  } catch {
    // Echec d'ecriture : la session vit en memoire pour cette partie. Le
    // joueur devra se reconnecter au prochain lancement, ce qui vaut mieux
    // que de refuser de jouer.
  }
}

export async function effacerJeton(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CLE);
  } catch {
    // Rien a faire : si on ne peut pas l'effacer, il expirera.
  }
}
