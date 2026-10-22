import { SettingsSheet } from '@/components/SettingsSheet';
import { AppHeader } from '@/components/views/AppHeader';
import { HomeView } from '@/components/views/HomeView';
import { FetchedView } from '@/components/views/FetchedView';
import { DownloadingView } from '@/components/views/DownloadingView';
import { CompleteView } from '@/components/views/CompleteView';
import { HistoryProvider } from '@/hooks/useHistory';
import { useAppFlow } from '@/hooks/useAppFlow';

function AppScreen() {
  const flow = useAppFlow();
  const { view } = flow;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-app relative">
      {flow.settingsOpen && (
        <SettingsSheet
          open={flow.settingsOpen}
          onClose={() => flow.setSettingsOpen(false)}
          outputDir={flow.outputDir}
          onOutputDirChange={flow.setOutputDir}
          cookiesBrowser={flow.cookiesBrowser}
          onCookiesBrowserChange={flow.setCookiesBrowser}
          detectedBrowsers={flow.detectedBrowsers}
        />
      )}

      <AppHeader
        showBack={view !== 'home'}
        backDisabled={view === 'downloading'}
        onBack={flow.handleReset}
        onOpenSettings={() => flow.setSettingsOpen(true)}
      />

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
