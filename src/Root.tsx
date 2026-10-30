import type { ReactNode } from 'react';
import { SuiteRoot } from './suite/SuiteRoot';
import { changelogs } from './suite/changelogs';
import { useLang, useT } from './lib/locale';
import { releaseNotes } from './lib/tauri-commands';

/** The parts the apps of the suite share (update check and banner, What's new). */
export function Root({ children }: { children: ReactNode }) {
  const { lang } = useLang();
  const t = useT();
  return (
    <SuiteRoot
      lang={lang}
      t={t}
      appId="light-scrap-vidz"
      appName="LightScrapVidz"
      changelogs={changelogs}
      fetchNotes={releaseNotes}
    >
      {children}
    </SuiteRoot>
  );
}
