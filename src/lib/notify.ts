const NOTIFY_KEY = 'light-scrap-vidz:notify';

/** Notifications are on unless the user switched them off. */
export function loadNotify(): boolean {
  try {
    return localStorage.getItem(NOTIFY_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveNotify(on: boolean): void {
  try {
    localStorage.setItem(NOTIFY_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice only lasts for this session
  }
}
