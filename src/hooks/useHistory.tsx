import { createContext, createElement, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { HistoryEntry } from '@/types';

const STORAGE_KEY = 'light-scrap-vidz:history';
const LEGACY_STORAGE_KEY = 'light-scrap-vidZ:history';
const MAX_ENTRIES = 50;

function loadHistory(): HistoryEntry[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      // Adopt the history saved under the pre-rename key.
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw !== null) {
        localStorage.setItem(STORAGE_KEY, raw);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable: keep the in-memory history
  }
}

interface UseHistoryReturn {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

function useHistoryState(): UseHistoryReturn {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setEntries([]);
  }, []);

  return { entries, addEntry, clearHistory };
}

const HistoryContext = createContext<UseHistoryReturn | null>(null);

/** One history shared by everything that reads or writes it: the download view, the queue
 * and the "Recent" tab. Separate instances each kept their own copy and drifted apart. */
export function HistoryProvider({ children }: { children: ReactNode }) {
  return createElement(HistoryContext.Provider, { value: useHistoryState() }, children);
}

/** The shared history; a standalone one outside a provider (tests, isolated hooks). */
export function useHistory(): UseHistoryReturn {
  const standalone = useHistoryState();
  return useContext(HistoryContext) ?? standalone;
}
