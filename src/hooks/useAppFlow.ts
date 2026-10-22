import { useState, useCallback, useEffect } from 'react';
import { useVideoInfo } from '@/hooks/useVideoInfo';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';
import { useDownload } from '@/hooks/useDownload';
import { useHistory } from '@/hooks/useHistory';
import { useQueue } from '@/hooks/useQueue';
import { isPlaylistUrl, getPlatform, normalizeUrl } from '@/lib/url-validator';
import { detectInstalledBrowsers } from '@/lib/tauri-commands';
import { loadOutputDir, saveOutputDir } from '@/lib/output-dir';
import type { CookiesBrowser, Quality, UrlKind } from '@/types';

const NEEDS_AUTH_PLATFORMS = new Set(['instagram', 'tiktok', 'facebook']);

export type AppView = 'home' | 'fetched' | 'downloading' | 'complete';

/** All the state and handlers behind the main screen; the views only render it. */
export function useAppFlow() {
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

  const handleSetOutputDir = useCallback((dir: string) => {
    setOutputDir(dir);
    saveOutputDir(dir);
  }, []);

  useEffect(() => {
    void detectInstalledBrowsers()
      .then(setDetectedBrowsers)
      .catch(() => {});
  }, []);

  const video = useVideoInfo();
  const playlist = usePlaylistInfo();
  const { entries, clearHistory } = useHistory();
  const dl = useDownload();
  const queue = useQueue();

  const { info, reset: resetInfo, fetchInfo } = video;
  const { info: plInfo, reset: resetPlInfo, fetchInfo: fetchPlInfo } = playlist;
  const { download, reset: resetDownload } = dl;
  const { addItems: addToQueue } = queue;

  const activeLookup = urlKind === 'single' ? video : playlist;
  const isFetching = activeLookup.status === 'loading';
  const fetchError = activeLookup.status === 'error' ? activeLookup.error : null;
  const isBusy = isFetching || dl.status === 'downloading';
  const showContent = (urlKind === 'single' && !!info) || (urlKind === 'playlist' && !!plInfo);

  const view: AppView =
    dl.status === 'downloading'
      ? 'downloading'
      : dl.status === 'complete'
        ? 'complete'
        : showContent
          ? 'fetched'
          : 'home';

  // Platforms that need a login get the first detected browser. The state update lands
  // after the request, so the effective browser is returned for it to use right away.
  const pickBrowserFor = useCallback(
    (submittedUrl: string): CookiesBrowser => {
      const platform = getPlatform(submittedUrl);
      if (NEEDS_AUTH_PLATFORMS.has(platform) && !cookiesBrowser && detectedBrowsers.length > 0) {
        const detected = detectedBrowsers[0] as CookiesBrowser;
        setCookiesBrowser(detected);
        return detected;
      }
      return cookiesBrowser;
    },
    [cookiesBrowser, detectedBrowsers],
  );

  const handleFetchInfo = useCallback(
    async (rawUrl: string) => {
      const submittedUrl = normalizeUrl(rawUrl);
      setUrl(submittedUrl);
      resetDownload();
      resetInfo();
      resetPlInfo();
      setSelectedPlaylistUrls([]);
      const browser = pickBrowserFor(submittedUrl);

      if (isPlaylistUrl(submittedUrl)) {
        setUrlKind('playlist');
        await fetchPlInfo(submittedUrl, browser ?? undefined);
      } else {
        setUrlKind('single');
        await fetchInfo(submittedUrl, browser ?? undefined);
      }
    },
    [fetchInfo, fetchPlInfo, resetDownload, resetInfo, resetPlInfo, pickBrowserFor],
  );

  const handleDownload = useCallback(async () => {
    if (!outputDir) return;
    if (urlKind === 'playlist' && selectedPlaylistUrls.length > 0) {
      addToQueue(
        selectedPlaylistUrls.map((u) => ({
          url: u,
          outputDir,
          quality,
          audioOnly,
          playlistEnd: null,
          cookiesBrowser,
        })),
      );
      setTab('queue');
      return;
    }
    if (urlKind === 'playlist' && plInfo) {
      await download(url, outputDir, quality, null, plInfo, playlistEnd, cookiesBrowser, audioOnly);
    } else if (info) {
      await download(url, outputDir, quality, info, null, null, cookiesBrowser, audioOnly);
    }
  }, [
    info,
    plInfo,
    outputDir,
    url,
    quality,
    urlKind,
    playlistEnd,
    cookiesBrowser,
    audioOnly,
    download,
    selectedPlaylistUrls,
    addToQueue,
  ]);

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

  // Show the queue tab when the queue becomes active (adjusted while rendering).
  const [queueWasActive, setQueueWasActive] = useState(queue.isActive);
  if (queue.isActive !== queueWasActive) {
    setQueueWasActive(queue.isActive);
    if (queue.isActive) setTab('queue');
  }

  const isPlaylist = urlKind === 'playlist';
  const playlistTotal = plInfo ? (plInfo.playlist_count ?? plInfo.entries?.length ?? 0) : 0;
  // The count selector caps a whole-playlist download, so the button must say so.
  const playlistCount = playlistEnd > 0 ? Math.min(playlistEnd, playlistTotal) : playlistTotal;

  return {
    view,
    url,
    urlKind,
    isPlaylist,
    quality,
    setQuality,
    outputDir,
    setOutputDir: handleSetOutputDir,
    playlistEnd,
    setPlaylistEnd,
    playlistCount,
    cookiesBrowser,
    setCookiesBrowser,
    audioOnly,
    setAudioOnly,
    detectedBrowsers,
    settingsOpen,
    setSettingsOpen,
    tab,
    setTab,
    selectedPlaylistUrls,
    setSelectedPlaylistUrls,
    info,
    plInfo,
    isFetching,
    fetchError,
    isBusy,
    entries,
    clearHistory,
    dl,
    queue,
    handleFetchInfo,
    handleDownload,
    handleAddToQueue,
    handleReset,
  };
}

export type Flow = ReturnType<typeof useAppFlow>;
