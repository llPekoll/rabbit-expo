/**
 * Ou l'app native va chercher le serveur.
 *
 * En natif il n'y a pas d'origine : `fetch('/api/auth/me')` ne veut rien dire.
 * Toutes les URLs relatives du jeu doivent donc etre prefixees par cette base.
 *
 * Reglable sans rebuild via `EXPO_PUBLIC_API_URL` (app.json > extra, ou .env).
 */
import Constants from 'expo-constants';

const depuisEnv = process.env.EXPO_PUBLIC_API_URL;
const depuisExtra = (Constants.expoConfig?.extra as any)?.apiUrl as string | undefined;

/** La base du serveur, sans slash final. */
export const API_URL = (depuisEnv ?? depuisExtra ?? '').replace(/\/+$/, '');

/** Prefixe une URL du jeu ('/api/auth/me') par la base du serveur. */
export function urlApi(chemin: string): string {
  if (/^https?:\/\//.test(chemin)) return chemin;
  return `${API_URL}${chemin.startsWith('/') ? chemin : `/${chemin}`}`;
}

export function apiConfiguree(): boolean {
  return API_URL.length > 0;
}
