import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UrlInput } from '@/components/UrlInput';
import { VideoPreview } from '@/components/VideoPreview';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import { FormatSelector } from '@/components/FormatSelector';
import { PlaylistEndSelector } from '@/components/PlaylistEndSelector';
import { FolderPicker } from '@/components/FolderPicker';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import { DownloadButton } from '@/components/DownloadButton';
import { ProgressCard } from '@/components/ProgressCard';
import { HistoryList } from '@/components/HistoryList';
import { QueuePanel } from '@/components/QueuePanel';
import { SettingsButton } from '@/components/SettingsButton';
import { useVideoInfo } from '@/hooks/useVideoInfo';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';
import { useDownload } from '@/hooks/useDownload';
import { useHistory } from '@/hooks/useHistory';
import { useQueue } from '@/hooks/useQueue';
import { isPlaylistUrl, getPlatform } from '@/lib/url-validator';
import { detectInstalledBrowsers, openFile, openFolder } from '@/lib/tauri-commands';
import { PLATFORM_TINT } from '@/lib/platform';
import { formatDuration } from '@/lib/utils';
import { loadOutputDir, saveOutputDir } from '@/lib/output-dir';
import { useT } from '@/lib/locale';
import type { CookiesBrowser, Quality, UrlKind } from '@/types';

const NEEDS_AUTH_PLATFORMS = new Set(['instagram', 'tiktok', 'facebook']);

type AppView = 'home' | 'fetched' | 'downloading' | 'complete';

export default function App() {
  const t = useT();
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('best');
  const [outputDir, setOutputDir] = useState(loadOutputDir);
  const [urlKind, setUrlKind] = useState<UrlKind>('single');
  const [playlistEnd, setPlaylistEnd] = useState<number>(10);
  const [cookiesBrowser, setCookiesBrowser] = useState<CookiesBrowser>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [detectedBrowsers, setDetectedBrowsers] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'recent' | 'queue'>('recent');
  const [selectedPlaylistUrls, setSelectedPlaylistUrls] = useState<string[]>([]);

  // Persist output folder
  const handleSetOutputDir = useCallback((dir: string) => {
    setOutputDir(dir);
    saveOutputDir(dir);
  }, []);

  // Detect installed browsers on mount
  useEffect(() => {
    void detectInstalledBrowsers().then(setDetectedBrowsers).catch(() => {});
  }, []);

  const {
    info,
    status: infoStatus,
    error: infoError,
    fetchInfo,
    reset: resetInfo,
  } = useVideoInfo();

  const {
    info: plInfo,
    status: plStatus,
    error: plError,
    fetchInfo: fetchPlInfo,
    reset: resetPlInfo,
  } = usePlaylistInfo();

  const { status, progress, completedPath, error: dlError, download, cancel, reset: resetDownload } = useDownload();

  const { entries, clearHistory } = useHistory();

  const { items: queueItems, isActive: queueActive, addItems: addToQueue, removeItem: removeQueueItem, clearDone: clearQueueDone, clearAll: clearQueueAll } = useQueue();

  const activeInfoStatus = urlKind === 'single' ? infoStatus : plStatus;
  const activeError = urlKind === 'single' ? infoError : plError;
  const isFetching = activeInfoStatus === 'loading';
  const fetchError = activeInfoStatus === 'error' ? activeError : null;
  const isBusy = isFetching || status === 'downloading';
  const showContent =
    (urlKind === 'single' && !!info) || (urlKind === 'playlist' && !!plInfo);

  const view: AppView =
    status === 'downloading'
      ? 'downloading'
      : status === 'complete'
        ? 'complete'
        : showContent
          ? 'fetched'
          : 'home';

  // Auto-suggest browser for platforms that need auth
  const handleUrlChange = useCallback((submittedUrl: string) => {
    const platform = getPlatform(submittedUrl);
    if (NEEDS_AUTH_PLATFORMS.has(platform) && !cookiesBrowser && detectedBrowsers.length > 0) {
      setCookiesBrowser(detectedBrowsers[0] as CookiesBrowser);
    }
  }, [cookiesBrowser, detectedBrowsers]);

  const handleFetchInfo = useCallback(
    async (submittedUrl: string) => {
      setUrl(submittedUrl);
      resetDownload();
      resetInfo();
      resetPlInfo();
      setSelectedPlaylistUrls([]);
      handleUrlChange(submittedUrl);

      if (isPlaylistUrl(submittedUrl)) {
        setUrlKind('playlist');
        await fetchPlInfo(submittedUrl, cookiesBrowser ?? undefined);
      } else {
        setUrlKind('single');
        await fetchInfo(submittedUrl, cookiesBrowser ?? undefined);
      }
    },
    [fetchInfo, fetchPlInfo, resetDownload, resetInfo, resetPlInfo, cookiesBrowser, handleUrlChange],
  );

  const handleDownload = useCallback(async () => {
    if (!outputDir) return;
    if (urlKind === 'playlist' && selectedPlaylistUrls.length > 0) {
      addToQueue(selectedPlaylistUrls.map((u) => ({
        url: u,
        outputDir,
        quality,
        audioOnly,
        playlistEnd: null,
        cookiesBrowser,
      })));
      setTab('queue');
      return;
    }
    if (urlKind === 'playlist' && plInfo) {
      await download(url, outputDir, quality, null, plInfo, playlistEnd, cookiesBrowser, audioOnly);
    } else if (info) {
      await download(url, outputDir, quality, info, null, null, cookiesBrowser, audioOnly);
    }
  }, [info, plInfo, outputDir, url, quality, urlKind, playlistEnd, cookiesBrowser, audioOnly, download, selectedPlaylistUrls, addToQueue]);

  const handleAddToQueue = useCallback(
    (urls: string[]) => {
      if (!outputDir) return;
      addToQueue(
        urls.map((u) => ({
          url: u,
          outputDir,
          quality,
          audioOnly,
          playlistEnd: isPlaylistUrl(u) ? playlistEnd : null,
          cookiesBrowser,
        })),
      );
      setTab('queue');
    },
    [addToQueue, outputDir, quality, audioOnly, playlistEnd, cookiesBrowser],
  );

  const handleReset = useCallback(() => {
    setUrl('');
    setUrlKind('single');
    resetInfo();
    resetPlInfo();
    resetDownload();
    setSelectedPlaylistUrls([]);
  }, [resetInfo, resetPlInfo, resetDownload]);

  // Switch to queue tab when queue becomes active
  useEffect(() => {
    if (queueActive) setTab('queue');
  }, [queueActive]);

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const doneCount = queueItems.filter((i) => i.status === 'done' || i.status === 'error').length;

  const isPlaylist = urlKind === 'playlist';
  const playlistCount = plInfo ? plInfo.playlist_count ?? plInfo.entries?.length ?? 0 : 0;

  // Complete-view recap data
  const completeTitle = isPlaylist ? plInfo?.title || t('dl.playlist') : info?.title || t('dl.download');
  const completeThumb = isPlaylist ? '' : info?.thumbnail ?? '';
  const completePlatform = getPlatform(url);
  const completeTint = PLATFORM_TINT[completePlatform];
  const completeMeta = isPlaylist
    ? t('dl.playlistMeta', { count: playlistCount })
    : [info?.uploader, info && info.duration > 0 ? formatDuration(info.duration) : null].filter(Boolean).join(' · ');

  const optionRowStyle: React.CSSProperties = { padding: '14px 15px' };
  const separatorStyle: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.06)' };
  const ghostButton: React.CSSProperties = {
    height: 48,
    borderRadius: 12,
    background: '#211F1B',
    border: '1px solid rgba(255,255,255,0.10)',
    color: '#D6D1C8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    transition: 'all .15s',
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        background: '#141310',
        position: 'relative',
      }}
    >
      {/* Settings sheet overlay */}
      {settingsOpen && (
        <SettingsButton
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          outputDir={outputDir}
          onOutputDirChange={handleSetOutputDir}
          cookiesBrowser={cookiesBrowser}
          onCookiesBrowserChange={setCookiesBrowser}
          detectedBrowsers={detectedBrowsers}
        />
      )}

      {/* Title bar */}
      <div
        style={{
          height: 46,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
        }}
      >
        {/* Back button — visible only when not on home view */}
        {view !== 'home' && (
          <button
            onClick={handleReset}
            style={{ width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#857F75', transition: 'all .15s', flexShrink: 0 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#211F1B'; (e.currentTarget as HTMLButtonElement).style.color = '#D6D1C8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#857F75'; }}
            aria-label={t('header.back')}
            disabled={view === 'downloading'}
            title={t(view === 'downloading' ? 'header.backBlocked' : 'header.back')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: '#C9F25E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14140C' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" />
            </svg>
          </div>
          <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#EFEBE4' }}>light-scrap-vidz</span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#857F75', transition: 'all .15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#211F1B'; (e.currentTarget as HTMLButtonElement).style.color = '#D6D1C8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#857F75'; }}
          aria-label={t('header.settings')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h11" /><path d="M19 7h1" /><path d="M4 17h5" /><path d="M13 17h7" />
            <circle cx="16" cy="7" r="2.4" /><circle cx="10" cy="17" r="2.4" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '22px 24px 0', overflow: 'hidden' }}>
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
              <UrlInput onSubmit={handleFetchInfo} isLoading={isFetching} showTryChips />
              {fetchError && <div style={{ fontSize: '11.5px', color: '#FF8A8A' }}>{t(fetchError)}</div>}

              {/* Tab bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: '#1A1916', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 11 }}>
                  <button
                    onClick={() => setTab('recent')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: '12.5px', fontWeight: 600,
                      background: tab === 'recent' ? '#2A2823' : 'transparent',
                      color: tab === 'recent' ? '#F0ECE4' : '#857F75',
                      transition: 'all .15s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                    </svg>
                    {t('tab.recent')}
                  </button>
                  <button
                    onClick={() => setTab('queue')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: '12.5px', fontWeight: 600,
                      background: tab === 'queue' ? '#2A2823' : 'transparent',
                      color: tab === 'queue' ? '#F0ECE4' : '#857F75',
                      transition: 'all .15s',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />
                    </svg>
                    {t('tab.queue')}
                    {pendingCount > 0 && (
                      <span style={{ minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#C9F25E', color: '#14140C', fontSize: '10px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pendingCount}
                      </span>
                    )}
                  </button>
                </div>

                {tab === 'recent' && entries.length > 0 && (
                  <button
                    onClick={clearHistory}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6F6960', transition: 'all .15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#A39D93'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6F6960'; }}
                  >
                    {t('tab.clearAll')}
                  </button>
                )}
                {tab === 'queue' && queueItems.length > 0 && (
                  <button
                    onClick={doneCount > 0 ? clearQueueDone : clearQueueAll}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, color: '#6F6960', transition: 'all .15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#A39D93'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6F6960'; }}
                  >
                    {t(doneCount > 0 ? 'tab.clearDone' : 'tab.clearAll')}
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: 22 }}>
                {tab === 'recent' ? (
                  <HistoryList entries={entries} onClear={clearHistory} onSelect={handleFetchInfo} isLoading={isFetching} />
                ) : (
                  <QueuePanel
                    items={queueItems}
                    onAddUrls={handleAddToQueue}
                    onRemoveItem={removeQueueItem}
                    onClearDone={clearQueueDone}
                    onClearAll={clearQueueAll}
                  />
                )}
              </div>
            </motion.div>
          )}

          {view === 'fetched' && (
            <motion.div key="fetched" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', paddingBottom: 22 }}>
              <UrlInput onSubmit={handleFetchInfo} isLoading={isFetching} showTryChips={false} />
              {fetchError && <div style={{ fontSize: '11.5px', color: '#FF8A8A' }}>{t(fetchError)}</div>}

              {/* Preview card */}
              {urlKind === 'single' && info && <VideoPreview info={info} url={url} />}
              {urlKind === 'playlist' && plInfo && (
                <PlaylistPreview
                  info={plInfo}
                  url={url}
                  selectedUrls={selectedPlaylistUrls}
                  onSelectionChange={setSelectedPlaylistUrls}
                  disabled={isBusy}
                />
              )}

              {/* Options card */}
              <div style={{ background: '#1A1916', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={optionRowStyle}>
                  <FormatSelector
                    audioOnly={audioOnly}
                    onAudioOnlyChange={setAudioOnly}
                    quality={quality}
                    onQualityChange={setQuality}
                    disabled={isBusy}
                  />
                </div>
                <div style={separatorStyle} />
                <div style={optionRowStyle}>
                  <FolderPicker value={outputDir} onChange={handleSetOutputDir} disabled={isBusy} />
                </div>
                <div style={separatorStyle} />
                <div style={optionRowStyle}>
                  <BrowserCookieSelector
                    value={cookiesBrowser}
                    onChange={setCookiesBrowser}
                    disabled={isBusy}
                    detectedBrowsers={detectedBrowsers}
                  />
                </div>
                {isPlaylist && selectedPlaylistUrls.length === 0 && (
                  <>
                    <div style={separatorStyle} />
                    <div style={optionRowStyle}>
                      <PlaylistEndSelector value={playlistEnd} onChange={setPlaylistEnd} disabled={isBusy} />
                    </div>
                  </>
                )}
              </div>

              {/* Download button */}
              <DownloadButton
                disabled={!outputDir || isBusy}
                audioOnly={audioOnly}
                isPlaylist={isPlaylist}
                playlistCount={playlistCount}
                selectedCount={selectedPlaylistUrls.length}
                onDownload={handleDownload}
              />
            </motion.div>
          )}

          {view === 'downloading' && (
            <motion.div key="downloading" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <ProgressCard status={status} progress={progress} error={dlError} />
              <button
                onClick={cancel}
                style={{ padding: '10px 22px', borderRadius: 11, background: '#211F1B', border: '1px solid rgba(255,255,255,0.10)', color: '#C2BCB2', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#FF8A8A'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,138,138,0.3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C2BCB2'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)'; }}
              >
                {t('dl.cancel')}
              </button>
            </motion.div>
          )}

          {view === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              {/* Check icon */}
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(201,242,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9F25E' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              {/* Title + saved path */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: '#F1EDE6', letterSpacing: '-0.01em' }}>{t('dl.complete')}</div>
                {completedPath && (
                  <div style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace", color: '#6F6960', marginTop: 5, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
                    {completedPath}
                  </div>
                )}
              </div>

              {/* Recap card */}
              <div style={{ width: '100%', maxWidth: 420, background: '#1A1916', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 16, padding: '13px 15px', alignItems: 'center' }}>
                <div style={{ width: 56, height: 36, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                  {completeThumb ? (
                    <img src={completeThumb} alt={completeTitle} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(135deg, #211F1A 0 7px, #1A1815 7px 14px)', position: 'relative' }}>
                      <div style={{ position: 'absolute', inset: 0, background: completeTint, opacity: 0.12 }} />
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#EAE6DF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{completeTitle}</div>
                  {completeMeta && (
                    <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#857F75', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{completeMeta}</div>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ width: '100%', maxWidth: 420, display: 'flex', gap: 9 }}>
                <button
                  onClick={() => completedPath && void openFile(completedPath)}
                  style={{ ...ghostButton, width: 48, padding: 0 }}
                  aria-label={t('dl.openFile')}
                  title={t('dl.openFile')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z" /></svg>
                </button>
                <button
                  onClick={() => completedPath && void openFolder(completedPath)}
                  style={{ ...ghostButton, width: 48, padding: 0 }}
                  aria-label={t('dl.reveal')}
                  title={t('dl.reveal')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                  </svg>
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    flex: 1, height: 48, borderRadius: 12, border: 'none', background: '#C9F25E', color: '#14140C',
                    fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 28px rgba(201,242,94,0.32)', transition: 'all .15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
                >
                  Download another
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
