import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getT, type Lang } from './i18n';

const LANG_KEY = 'light-scrap-vidz:language';

/** La langue retenue au dernier lancement. Anglais par défaut : c'est la seule
 * langue que l'app parlait avant, donc une mise à jour ne déplace personne. */
export function loadLang(): Lang {
  return localStorage.getItem(LANG_KEY) === 'fr' ? 'fr' : 'en';
}

export function saveLang(lang: Lang): void {
  localStorage.setItem(LANG_KEY, lang);
}

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const setLang = useCallback((next: Lang) => {
    saveLang(next);
    setLangState(next);
    document.documentElement.lang = next;
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function useT() {
  const { lang } = useContext(LangCtx);
  return useMemo(() => getT(lang), [lang]);
}
