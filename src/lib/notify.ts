import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getItem, setItem } from './storage';

const NOTIFY_KEY = 'light-scrap-vidz:notify';

/** Notifications are on unless the user switched them off. */
export function loadNotify(): boolean {
  return getItem(NOTIFY_KEY) !== 'off';
}

export function saveNotify(on: boolean): void {
  setItem(NOTIFY_KEY, on ? 'on' : 'off');
}

/** Système de notification du bureau, quand l'utilisateur ne l'a pas coupé. Échoue en
 * silence : une notification n'est jamais indispensable. */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!loadNotify()) return;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      granted = (await requestPermission()) === 'granted';
    }
    if (granted) sendNotification({ title, body });
  } catch {
    // notifications not critical
  }
}
