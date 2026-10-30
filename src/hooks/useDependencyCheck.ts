import { useCallback, useEffect, useState } from 'react';
import { checkDependencies } from '@/lib/tauri-commands';

export type Warning = 'ffmpeg' | 'jsRuntime';

/** Ce qui manque sur la machine et que l'utilisateur doit installer, vérifié au démarrage.
 * Un avertissement fermé reste fermé jusqu'au prochain lancement. */
export function useDependencyCheck() {
  const [missing, setMissing] = useState<Warning[]>([]);
  const [dismissed, setDismissed] = useState<Warning[]>([]);

  useEffect(() => {
    let current = true;
    void checkDependencies()
      .then((status) => {
        if (!current) return;
        const found: Warning[] = [];
        if (!status.ffmpeg) found.push('ffmpeg');
        if (!status.js_runtime) found.push('jsRuntime');
        setMissing(found);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  const dismiss = useCallback((warning: Warning) => {
    setDismissed((prev) => [...prev, warning]);
  }, []);

  return { warnings: missing.filter((w) => !dismissed.includes(w)), dismiss };
}
