import { open } from '@tauri-apps/plugin-dialog';

/** Ouvre le sélecteur de dossier du système ; `null` si l'utilisateur annule. */
export async function pickFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === 'string' && selected ? selected : null;
}
