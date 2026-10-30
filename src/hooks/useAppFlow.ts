import { useState, useCallback } from 'react';
import { useVideoInfo } from '@/hooks/useVideoInfo';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';
import { useDownload } from '@/hooks/useDownload';
import { useHistory } from '@/hooks/useHistory';
import { useQueue } from '@/hooks/useQueue';
import { usePreferences } from '@/hooks/usePreferences';
import { useDependencyCheck } from '@/hooks/useDependencyCheck';
import { isPlaylistUrl, normalizeUrl } from '@/lib/url-validator';
import { resolveCookies } from '@/lib/cookies';
import { cancelLookup } from '@/lib/tauri-commands';
import type { UrlKind } from '@/types';

export type AppView = 'home' | 'fetched' | 'downloading' | 'complete';

/** All the state and handlers behind the main screen; the views only render it. */
export function useAppFlow() {
  const prefs = usePreferences();
  const { quality, audioOnly, playlistEnd, cookiesChoice, outputDir, detectedBrowsers } = prefs;
  const dependencies = useDependencyCheck();

  // What the user typed, kept here so it survives the view changing under the input.
  const [inputUrl, setInputUrl] = useState('');
  // The URL actually sent to yt-dlp (normalised).
  const [url, setUrl] = useState('');
  const [urlKind, setUrlKind] = useState<UrlKind>('single');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<'recent' | 'queue'>('recent');
  const [selectedPlaylistUrls, setSelectedPlaylistUrls] = useState<string[]>([]);

  const video = useVideoInfo();
  const playlist = usePlaylistInfo();
  const { entries, clearHistory, removeEntry } = useHistory();
  const dl = useDownload();
  const queue = useQueue();

  const { info, reset: resetInfo, fetchInfo } = video;
  const {
    info: plInfo,
    reset: resetPlInfo,
    fetchInfo: fetchPlInfo,
    loadMore: loadMorePlaylist,
  } = playlist;
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

  // The browser whose cookies a request may read. The automatic pick applies to this
  // request only: it never rewrites what the user chose.
  const cookiesFor = useCallback(
    (target: string) => resolveCookies(cookiesChoice, target, detectedBrowsers),
    [cookiesChoice, detectedBrowsers],
  );

  const handleFetchInfo = useCallback(
    async (rawUrl: string) => {
      const typed = rawUrl.trim();
      // The kind is decided on what was typed: the normalised form (a channel's Videos
      // tab) would no longer look like a channel.
      const kind: UrlKind = isPlaylistUrl(typed) ? 'playlist' : 'single';
      const submittedUrl = normalizeUrl(typed);
      setInputUrl(typed);
      setUrl(submittedUrl);
      resetDownload();
      resetInfo();
      resetPlInfo();
      setSelectedPlaylistUrls([]);
      const browser = cookiesFor(submittedUrl);

      if (kind === 'playlist') {
        setUrlKind('playlist');
        await fetchPlInfo(submittedUrl, browser ?? undefined);
      } else {
        setUrlKind('single');
        await fetchInfo(submittedUrl, browser ?? undefined);
      }
    },
    [fetchInfo, fetchPlInfo, resetDownload, resetInfo, resetPlInfo, cookiesFor],
  );

  const handleLoadMore = useCallback(
    () => loadMorePlaylist(url, cookiesFor(url) ?? undefined),
    [loadMorePlaylist, url, cookiesFor],
  );

  const handleDownload = useCallback(async () => {
    if (!outputDir) return;
    const browser = cookiesFor(url);
    if (urlKind === 'playlist' && selectedPlaylistUrls.length > 0) {
      const titles = new Map((plInfo?.entries ?? []).map((e) => [e.url, e.title]));
      addToQueue(
        selectedPlaylistUrls.map((u) => ({
          url: u,
          title: titles.get(u) || undefined,
          outputDir,
          quality,
          audioOnly,
          playlistEnd: null,
          cookiesBrowser: cookiesFor(u),
        })),
      );
      setTab('queue');
      return;
    }
    if (urlKind === 'playlist' && plInfo) {
      await download(url, outputDir, quality, null, plInfo, playlistEnd, browser, audioOnly);
    } else if (info) {
      await download(url, outputDir, quality, info, null, null, browser, audioOnly);
    }
  }, [
    info,
    plInfo,
    outputDir,
    url,
    quality,
    urlKind,
    playlistEnd,
    cookiesFor,
    audioOnly,
    download,
    selectedPlaylistUrls,
    addToQueue,
  ]);

  /** Ajoute des liens à la file ; renvoie combien ont été ajoutés (les doublons ne le sont
   * pas). */
  const handleAddToQueue = useCallback(
    (urls: string[]): number => {
      if (!outputDir) return 0;
      const added = addToQueue(
        urls.map((typed) => {
          const submitted = normalizeUrl(typed);
          return {
            url: submitted,
            outputDir,
            quality,
            audioOnly,
            // Decided on the typed link, before it is normalised.
            playlistEnd: isPlaylistUrl(typed) ? playlistEnd : null,
            cookiesBrowser: cookiesFor(submitted),
          };
        }),
      );
      setTab('queue');
      return added;
    },
    [addToQueue, outputDir, quality, audioOnly, playlistEnd, cookiesFor],
  );

  const handleReset = useCallback(() => {
    // Going back while a lookup runs abandons it instead of leaving yt-dlp busy.
    if (isFetching) void cancelLookup(urlKind === 'single' ? 'video' : 'playlist').catch(() => {});
    setUrl('');
    setInputUrl('');
    setUrlKind('single');
    resetInfo();
    resetPlInfo();
    resetDownload();
    setSelectedPlaylistUrls([]);
  }, [isFetching, urlKind, resetInfo, resetPlInfo, resetDownload]);

  // Show the queue tab when the queue becomes active (adjusted while rendering).
  const [queueWasActive, setQueueWasActive] = useState(queue.isActive);
  if (queue.isActive !== queueWasActive) {
    setQueueWasActive(queue.isActive);
    if (queue.isActive) setTab('queue');
  }

  const isPlaylist = urlKind === 'playlist';
  const loadedEntries = plInfo?.entries?.length ?? 0;
  const knownTotal = plInfo?.playlist_count ?? null;
  const playlistTotal = plInfo ? (knownTotal ?? loadedEntries) : 0;
  // The count selector caps a whole-playlist download, so the button must say so.
  const playlistCount = playlistEnd > 0 ? Math.min(playlistEnd, playlistTotal) : playlistTotal;
  // Without a total from the platform, only the entries read so far are certain: the
  // number of a "whole playlist" download is then unknown.
  const playlistCountApprox =
    isPlaylist && knownTotal === null && playlist.hasMore && (playlistEnd === 0 || playlistEnd > loadedEntries);

  return {
    view,
    url,
    inputUrl,
    setInputUrl,
    urlKind,
    isPlaylist,
    quality: prefs.quality,
    setQuality: prefs.setQuality,
    outputDir,
    setOutputDir: prefs.setOutputDir,
    playlistEnd,
    setPlaylistEnd: prefs.setPlaylistEnd,
    playlistCount,
    playlistCountApprox,
    hasMoreEntries: playlist.hasMore,
    loadingMoreEntries: playlist.loadingMore,
    moreEntriesError: playlist.moreError,
    loadMoreEntries: handleLoadMore,
    cookiesChoice,
    setCookiesChoice: prefs.setCookiesChoice,
    audioOnly,
    setAudioOnly: prefs.setAudioOnly,
    detectedBrowsers,
    warnings: dependencies.warnings,
    dismissWarning: dependencies.dismiss,
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
    removeHistoryEntry: removeEntry,
    dl,
    queue,
    handleFetchInfo,
    handleDownload,
    handleAddToQueue,
    handleReset,
  };
}

export type Flow = ReturnType<typeof useAppFlow>;
