/** Accès à `localStorage` qui ne lève jamais : le stockage peut manquer (fenêtre privée,
 * données bloquées) ou être plein, et l'app doit alors simplement oublier d'une session à
 * l'autre au lieu de planter. */
export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable or full: the value only lasts for this session
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}
