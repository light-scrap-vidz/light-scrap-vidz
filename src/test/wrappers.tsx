import { useState, type ComponentProps, type ReactNode } from 'react';
import { UrlInput } from '@/components/UrlInput';
import { HistoryProvider } from '@/hooks/useHistory';
import { SuiteRoot } from '@/suite/SuiteRoot';
import { getT } from '@/lib/i18n';

/** Provider that hooks reading or writing the shared history need in `renderHook`. */
export function withHistory({ children }: { children: ReactNode }) {
  return <HistoryProvider>{children}</HistoryProvider>;
}

/** The URL box with its state held in a parent, as the app does. */
export function UrlBox(
  props: Omit<ComponentProps<typeof UrlInput>, 'value' | 'onChange'> & { initial?: string },
) {
  const { initial = '', ...rest } = props;
  const [value, setValue] = useState(initial);
  return <UrlInput {...rest} value={value} onChange={setValue} />;
}

/** The parts every app of the suite shares (update check, banner, What's new), around `ui`. */
export function withSuite(
  ui: ReactNode,
  {
    fetchNotes = () => Promise.resolve(''),
    changelogs = { en: '', fr: '' },
    lang = 'en',
  }: {
    fetchNotes?: (lang: 'en' | 'fr', version: string) => Promise<string>;
    changelogs?: { en: string; fr: string };
    lang?: 'en' | 'fr';
  } = {},
) {
  return (
    <SuiteRoot
      lang={lang}
      t={getT(lang)}
      appId="test"
      appName="Test"
      changelogs={changelogs}
      fetchNotes={fetchNotes}
      checkOnStart={false}
    >
      {ui}
    </SuiteRoot>
  );
}
