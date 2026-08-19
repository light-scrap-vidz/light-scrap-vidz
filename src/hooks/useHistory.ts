import { useState, useCallback } from 'react';
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

interface UseHistoryReturn {
  entries: HistoryEntry[];
  addEntry: (entry: HistoryEntry) => void;
  clearHistory: () => void;
}

export function useHistory(): UseHistoryReturn {
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
