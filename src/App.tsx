import { useCallback, useEffect, useMemo } from 'react';
import { SettingsSheet } from '@/components/SettingsSheet';
import { EnvironmentNotice } from '@/components/EnvironmentNotice';
import { AppHeader } from '@/components/views/AppHeader';
import { HomeView } from '@/components/views/HomeView';
import { FetchedView } from '@/components/views/FetchedView';
import { DownloadingView } from '@/components/views/DownloadingView';
import { CompleteView } from '@/components/views/CompleteView';
import { HistoryProvider } from '@/hooks/useHistory';
import { useAppFlow } from '@/hooks/useAppFlow';
import { useLang, useT } from '@/lib/locale';
import { updateYtDlp } from '@/lib/tauri-commands';
import { parseYtdlpError } from '@/lib/error-parser';
import { useSuite } from '@/suite/UpdaterProvider';
import { useSuiteMenu } from '@/suite/useSuiteMenu';
import type { MenuSpec } from '@/suite/menu';

function AppScreen() {
  const flow = useAppFlow();
  const { view, setSettingsOpen } = flow;
  const t = useT();
  const { lang, setLang } = useLang();
  const { notify } = useSuite();

  // "Check for updates" also refreshes yt-dlp, which breaks whenever a site changes.
  const checkYtDlp = useCallback(() => {
    void updateYtDlp()
      .then((result) =>
        notify('success', t(result === 'updated' ? 'ytdlp.updated' : 'ytdlp.upToDate')),
      )
      .catch((err) =>
        notify('error', t(parseYtdlpError(err instanceof Error ? err.message : String(err)))),
      );
  }, [notify, t]);

  const file = useMemo<MenuSpec[]>(
    () => [
      {
        kind: 'item',
        text: t('menu.settings'),
        accelerator: 'CmdOrCtrl+,',
        action: () => setSettingsOpen(true),
      },
    ],
    [t, setSettingsOpen],
  );
  useSuiteMenu({
    t,
    lang,
    appName: 'LightScrapVidz',
    onLanguage: setLang,
    file,
    onCheckUpdates: checkYtDlp,
  });

  // The same shortcut as the menu entry, for when the native menu is not there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') setSettingsOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSettingsOpen]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app relative">
      <SettingsSheet
        open={flow.settingsOpen}
        onClose={() => flow.setSettingsOpen(false)}
        outputDir={flow.outputDir}
        onOutputDirChange={flow.setOutputDir}
        cookiesChoice={flow.cookiesChoice}
        onCookiesChoiceChange={flow.setCookiesChoice}
        detectedBrowsers={flow.detectedBrowsers}
      />

      {view !== 'home' && (
        <AppHeader showBack backDisabled={view === 'downloading'} onBack={flow.handleReset} />
      )}

      <EnvironmentNotice warnings={flow.warnings} onDismiss={flow.dismissWarning} />

      <div className="flex-1 min-h-[0px] flex flex-col [padding:22px_24px_0] overflow-hidden">
        {view === 'home' && <HomeView key="home" flow={flow} />}
        {view === 'fetched' && <FetchedView key="fetched" flow={flow} />}
        {view === 'downloading' && <DownloadingView key="downloading" flow={flow} />}
        {view === 'complete' && <CompleteView key="complete" flow={flow} />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HistoryProvider>
      <AppScreen />
    </HistoryProvider>
  );
}
