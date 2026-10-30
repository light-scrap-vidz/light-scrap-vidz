import { getPlatform } from '@/lib/url-validator';
import { getItem, setItem } from '@/lib/storage';
import type { CookiesBrowser, CookiesChoice } from '@/types';

const COOKIES_KEY = 'light-scrap-vidz:cookies';

/** Navigateurs dont yt-dlp sait lire les cookies ; la même liste que `validate::BROWSERS`
 * côté Rust. */
export const BROWSERS = [
  'firefox',
  'chrome',
  'chromium',
  'safari',
  'brave',
  'edge',
  'opera',
  'vivaldi',
] as const;

/** Plateformes qui exigent une session pour la plupart des contenus. TikTok n'en fait pas
 * partie : ses vidéos publiques passent sans cookies, et lire ceux d'un navigateur sans
 * l'accord de l'utilisateur n'est pas anodin. */
const NEEDS_AUTH_PLATFORMS = new Set(['instagram', 'facebook']);

function isBrowser(value: string | null): value is NonNullable<CookiesBrowser> {
  return !!value && (BROWSERS as readonly string[]).includes(value);
}

/** Le choix mémorisé : `auto` tant que l'utilisateur n'a rien décidé, puis `none` ou un
 * navigateur, qui restent ce qu'il a choisi. */
export function loadCookiesChoice(): CookiesChoice {
  const saved = getItem(COOKIES_KEY);
  return saved === 'none' || isBrowser(saved) ? saved : 'auto';
}

export function saveCookiesChoice(choice: CookiesChoice): void {
  setItem(COOKIES_KEY, choice);
}

/** Navigateur dont lire les cookies pour `url`. « Aucun » est respecté partout ; `auto`
 * n'a d'effet que pour la requête en cours, sur les sites qui exigent une session, et ne
 * change rien au choix de l'utilisateur. */
export function resolveCookies(
  choice: CookiesChoice,
  url: string,
  detected: string[],
): CookiesBrowser {
  if (choice === 'none') return null;
  if (choice !== 'auto') return choice;
  // Safari last: its cookies need the Full Disk Access permission, which a plain lookup of
  // a public post does not deserve to depend on.
  const first = detected.find((b) => isBrowser(b) && b !== 'safari') ?? detected.find(isBrowser);
  return first && NEEDS_AUTH_PLATFORMS.has(getPlatform(url)) ? first : null;
}
