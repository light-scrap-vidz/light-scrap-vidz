import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { HistoryEntry, Platform } from '@/types';
import { getItem, removeItem, setItem } from '@/lib/storage';

const STORAGE_KEY = 'light-scrap-vidz:history';
const LEGACY_STORAGE_KEY = 'light-scrap-vidZ:history';
const MAX_ENTRIES = 50;

const PLATFORMS: readonly Platform[] = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'dailymotion',
  'twitter',
  'twitch',
  'vimeo',
  'unknown',
];

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.url === 'string' &&
    typeof e.title === 'string' &&
    typeof e.thumbnail === 'string' &&
    typeof e.filepath === 'string' &&
    typeof e.downloaded_at === 'number' &&
    typeof e.quality === 'string' &&
    PLATFORMS.includes(e.platform as Platform)
  );
}

/** Lit l'historique enregistré. Une valeur illisible, ou une ligne de forme inattendue, est
 * écartée plutôt que de faire planter l'affichage. */
export function loadHistory(): HistoryEntry[] {
  let raw = getItem(STORAGE_KEY);
  if (raw === null) {
    // Adopt the history saved under the pre-rename key.
    raw = getItem(LEGACY_STORAGE_KEY);
    if (raw !== null) {
      setItem(STORAGE_KEY, raw);
      removeItem(LEGACY_STORAGE_KEY);
    }
  }
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  if (entries.length === 0) removeItem(STORAGE_KEY);
  else setItem(STORAGE_KEY, JSON.stringify(entries));
}

export interface UseHistoryReturn {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  clearHistory: () => void;
}

/** L'état de l'historique et sa sauvegarde, une fois par changement (dans un effet, pas
 * dans la fonction de mise à jour, que React peut exécuter deux fois). */
export function useHistoryState(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);
  const loaded = useRef(true);

  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    saveHistory(entries);
  }, [entries]);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback(() => setEntries([]), []);

  return { entries, addEntry, removeEntry, clearHistory };
}

const HistoryContext = createContext<UseHistoryReturn | null>(null);

/** One history shared by everything that reads or writes it: the download view, the queue
 * and the "Recent" tab. Separate instances each kept their own copy and drifted apart. */
export function HistoryProvider({ children }: { children: ReactNode }) {
  return createElement(HistoryContext.Provider, { value: useHistoryState() }, children);
}

/** The history shared through the provider; outside one it is a programming error. */
export function useHistory(): UseHistoryReturn {
  const shared = useContext(HistoryContext);
  if (!shared) throw new Error('useHistory must be used inside <HistoryProvider>');
  return shared;
}
