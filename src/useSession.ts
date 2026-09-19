/**
 * La session du joueur, cote natif.
 *
 * Reprend la logique de `use-wallet-login.tsx` (web) avec trois differences,
 * toutes imposees par la plateforme :
 *  - le jeton va dans le trousseau, pas dans localStorage (session.ts) ;
 *  - les URLs sont absolues : en natif `/api/auth/me` ne designe rien ;
 *  - pas de cookie de secours. Le web a un cookie HttpOnly qui survit au
 *    vidage du stockage ; ici le jeton EST la session.
 *
 * Le wallet viendra ensuite (Mobile Wallet Adapter). Pour l'instant seul le
 * mode invite est branche, ce qui suffit a valider toute la chaine :
 * ecran -> API -> jeton -> session.
 */
import { useCallback, useEffect, useState } from 'react';

import { urlApi, apiConfiguree } from './config';
import { effacerJeton, ecrireJeton, lireJeton } from './session';
import { prouverWallet, raisonWalletIndisponible, walletDisponible } from './wallet';

/** Ce que l'API rend, cf. `Player` dans use-wallet-login.tsx. */
export type Joueur = {
  id: string;
  name: string;
  wallet: string | null;
  guest: boolean;
  runsPlayed?: number;
};

/** Au-dela, on montre la porte plutot qu'un chargement sans fin. */
const ATTENTE_MAX_MS = 3000;

export type EtatSession = {
  joueur: Joueur | null;
  jeton: string | null;
  /** La session est en cours de verification au demarrage. */
  verification: boolean;
  /** Une action est en cours (connexion invite). */
  occupe: boolean;
  erreur: string | null;
  jouerEnInvite: () => Promise<void>;
  /** Ouvre le wallet, signe le challenge, ouvre la session. */
  connecterWallet: () => Promise<void>;
  /** Faux hors Android, et dans Expo Go (le MWA a un module natif). */
  walletPossible: boolean;
  /** Pourquoi le wallet n'est pas ouvrable, s'il ne l'est pas. */
  raisonWallet: string | null;
  deconnecter: () => Promise<void>;
};

export function useSession(): EtatSession {
  const [joueur, setJoueur] = useState<Joueur | null>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [verification, setVerification] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Au demarrage : un jeton en reserve vaut-il encore ?
  useEffect(() => {
    let vivant = true;

    (async () => {
      if (!apiConfiguree()) {
        if (vivant) {
          setErreur('Serveur non configure (EXPO_PUBLIC_API_URL)');
          setVerification(false);
        }
        return;
      }

      const sauve = await lireJeton();

      try {
        const ctrl = new AbortController();
        const minuteur = setTimeout(() => ctrl.abort(), ATTENTE_MAX_MS);
        // Sans jeton local on demande quand meme : le serveur accepte le
        // COOKIE seul et rend alors un jeton neuf (voir /api/auth/me). C'est
        // ce qui rattrape une reinstallation ou un trousseau vide.
        const rep = await fetch(urlApi('/api/auth/me'), {
          headers: sauve ? { Authorization: `Bearer ${sauve}` } : undefined,
          signal: ctrl.signal,
        });
        clearTimeout(minuteur);

        if (rep.ok) {
          const d = await rep.json();
          if (vivant && d?.player) {
            setJoueur(d.player as Joueur);
            // Le jeton rendu par /me quand on s'est identifie par cookie.
            const frais = (d.token as string | undefined) ?? sauve;
            if (frais) {
              setJeton(frais);
              if (frais !== sauve) await ecrireJeton(frais);
            }
          }
        } else if (rep.status === 401 || rep.status === 403) {
          // Le serveur dit non : le jeton est mort, pas la peine de le garder.
          if (sauve) await effacerJeton();
        }
        // Les autres codes (500, reseau) laissent le jeton en place : c'est
        // probablement le serveur qui a un souci, pas la session.
      } catch {
        // Hors ligne ou trop lent : on montre la porte, le jeton reste.
      } finally {
        if (vivant) setVerification(false);
      }
    })();

    return () => { vivant = false; };
  }, []);

  const jouerEnInvite = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      const rep = await fetch(urlApi('/api/auth/guest'), { method: 'POST' });
      if (!rep.ok) throw new Error(`le serveur a repondu ${rep.status}`);
      const d = await rep.json();
      if (!d?.token || !d?.player) throw new Error('reponse inattendue du serveur');

      await ecrireJeton(d.token);
      setJeton(d.token);
      setJoueur(d.player as Joueur);
    } catch (e: any) {
      setErreur(e?.message ?? 'connexion impossible');
    } finally {
      setOccupe(false);
    }
  }, []);

  const connecterWallet = useCallback(async () => {
    setOccupe(true);
    setErreur(null);
    try {
      // Le wallet signe le challenge : le serveur ne voit jamais de cle.
      const preuve = await prouverWallet();

      const rep = await fetch(urlApi('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preuve),
      });
      if (rep.status === 401) throw new Error('signature refusee');
      if (!rep.ok) throw new Error(`le serveur a repondu ${rep.status}`);

      const d = await rep.json();
      if (!d?.token || !d?.player) throw new Error('reponse inattendue du serveur');

      await ecrireJeton(d.token);
      setJeton(d.token);
      setJoueur(d.player as Joueur);
    } catch (e: any) {
      // Le joueur qui ferme le wallet n'a pas commis d'erreur : on ne lui
      // montre pas une panne.
      const m = String(e?.message ?? '');
      const annule = /cancel|dismiss|ERROR_ASSOCIATION_CANCELLED/i.test(m);
      setErreur(annule ? null : (m || 'connexion impossible'));
    } finally {
      setOccupe(false);
    }
  }, []);

  const deconnecter = useCallback(async () => {
    // Fermer la session LOCALE d'abord : l'ecran doit repartir tout de suite,
    // meme si le reseau traine.
    await effacerJeton();
    setJeton(null);
    setJoueur(null);

    /**
     * Puis le COOKIE, et on l'attend.
     *
     * `/api/auth/logout` repond avec un Set-Cookie a Max-Age=0. Or fetch
     * garde les cookies en React Native comme dans un navigateur, et
     * `/api/auth/me` accepte le cookie SEUL (il rend meme un jeton neuf sur
     * cette seule preuve). Sans cet appel — ou sans l'attendre — le prochain
     * demarrage retrouve la session qu'on vient de fermer : le joueur ne
     * peut plus se reconnecter autrement.
     */
    try {
      await fetch(urlApi('/api/auth/logout'), { method: 'POST' });
    } catch {
      // Hors ligne : le cookie expirera de lui-meme. La session locale est
      // fermee, ce qui est ce que le joueur a demande.
    }
  }, []);

  return {
    joueur, jeton, verification, occupe, erreur,
    jouerEnInvite, connecterWallet,
    walletPossible: walletDisponible(),
    raisonWallet: raisonWalletIndisponible(),
    deconnecter,
  };
}
