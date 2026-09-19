/**
 * La connexion par wallet, sur le Seeker.
 *
 * Le Mobile Wallet Adapter ouvre le wallet installe (le Seed Vault sur un
 * Seeker, ou tout wallet MWA), lui fait signer le challenge du serveur, et
 * rend la paire { adresse, signature }. Le serveur ne voit jamais de cle :
 * seulement une signature sur un nonce qu'il a lui-meme emis.
 *
 * MEME PROTOCOLE QUE LE WEB. `src/lib/auth/signature.ts` verifie une
 * signature ed25519 sur le message UTF-8, avec l'adresse ET la signature en
 * BASE58. Or le MWA travaille en base64 : d'ou les conversions ici. C'est
 * exactement ce que fait le pont Kotlin de seeker-app
 * (`Base58.encodeToString`), et le serveur n'a pas a savoir d'ou vient la
 * signature.
 *
 * NE MARCHE PAS DANS EXPO GO : le MWA a besoin de code natif Android, donc
 * d'un development build. Hors Android, `walletDisponible()` rend false et
 * l'ecran propose le mode invite.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import bs58 from 'bs58';
import { Buffer } from 'buffer';

import { urlApi } from './config';

/**
 * Expo Go ne peut PAS charger le MWA : il embarque un module natif Android,
 * et Expo Go ne contient que les modules de son propre build. Un import
 * statique ferait planter l'ecran entier au chargement — d'ou l'import
 * paresseux, qui n'a lieu que lorsqu'on ouvre vraiment le wallet.
 *
 * Tester le wallet demande un development build :
 *   bunx expo run:android      (ou eas build --profile development)
 */
const DANS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** L'identite que le wallet montre au joueur pendant l'autorisation. */
const IDENTITE = {
  name: 'Rabbit Royale',
  uri: 'https://rabbit.rip',
  icon: 'favicon.ico',
};

/** La chaine visee. Le jeu vit sur le mainnet. */
const CHAIN = 'solana:mainnet';

export function walletDisponible(): boolean {
  // Le MWA est une API Android, et son module natif n'existe pas dans Expo Go.
  return Platform.OS === 'android' && !DANS_EXPO_GO;
}

/** Pourquoi le wallet n'est pas ouvrable ici — a montrer au joueur. */
export function raisonWalletIndisponible(): string | null {
  if (Platform.OS !== 'android') return 'Le wallet n\'est disponible que sur Android.';
  if (DANS_EXPO_GO) return 'Le wallet demande un development build (pas Expo Go).';
  return null;
}

function base64VersBase58(b64: string): string {
  return bs58.encode(new Uint8Array(Buffer.from(b64, 'base64')));
}

export type PreuveWallet = { address: string; signature: string };

/**
 * Ouvre le wallet, fait signer le challenge, rend la preuve.
 *
 * Tout tient dans UNE session `transact` : autoriser puis signer dans deux
 * sessions separees rouvrirait le wallet deux fois, et le joueur verrait
 * deux ecrans d'approbation pour une seule connexion.
 */
export async function prouverWallet(): Promise<PreuveWallet> {
  // Import paresseux : voir DANS_EXPO_GO plus haut.
  const { transact } = await import('@solana-mobile/mobile-wallet-adapter-protocol');

  return transact(async (wallet) => {
    const autorisation = await wallet.authorize({
      chain: CHAIN,
      identity: IDENTITE,
    });

    const compte = autorisation.accounts[0];
    if (!compte) throw new Error('le wallet n\'a rendu aucun compte');

    // L'adresse arrive en base64 ; le serveur la veut en base58.
    const adresse = base64VersBase58(compte.address);

    // Le challenge est emis POUR cette adresse : il faut donc la connaitre
    // avant de le demander, d'ou l'ordre autorisation -> challenge -> signature.
    const rep = await fetch(urlApi('/api/auth/challenge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: adresse }),
    });
    if (!rep.ok) throw new Error(`challenge refuse (${rep.status})`);
    const { message } = (await rep.json()) as { message?: string };
    if (!message) throw new Error('le serveur n\'a pas rendu de message');

    const { signed_payloads } = await wallet.signMessages({
      addresses: [compte.address],
      payloads: [Buffer.from(message, 'utf8').toString('base64')],
    });

    const signee = signed_payloads[0];
    if (!signee) throw new Error('le wallet n\'a rien signe');

    // signMessages rend le MESSAGE SIGNE : le message d'origine suivi de ses
    // 64 octets de signature. C'est cette queue que le serveur verifie.
    const octets = new Uint8Array(Buffer.from(signee, 'base64'));
    const signature = bs58.encode(octets.slice(octets.length - 64));

    return { address: adresse, signature };
  });
}
