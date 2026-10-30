import { useState, useCallback, useEffect } from 'react';
import { downloadDir } from '@tauri-apps/api/path';
import { detectInstalledBrowsers } from '@/lib/tauri-commands';
import { loadOutputDir, saveOutputDir } from '@/lib/output-dir';
import { loadCookiesChoice, saveCookiesChoice } from '@/lib/cookies';
import {
  loadAudioOnly,
  loadPlaylistEnd,
  loadQuality,
  saveAudioOnly,
  savePlaylistEnd,
  saveQuality,
} from '@/lib/prefs';
import type { CookiesChoice, Quality } from '@/types';

/** Les réglages de téléchargement : mémorisés d'une session à l'autre, sauf le dossier par
 * défaut, qui suit celui du système tant que l'utilisateur n'en a pas choisi un. */
export function usePreferences() {
  const [quality, setQualityState] = useState<Quality>(loadQuality);
  const [audioOnly, setAudioOnlyState] = useState(loadAudioOnly);
  const [playlistEnd, setPlaylistEndState] = useState(loadPlaylistEnd);
  const [cookiesChoice, setCookiesChoiceState] = useState<CookiesChoice>(loadCookiesChoice);
  const [outputDir, setOutputDirState] = useState(loadOutputDir);
  const [detectedBrowsers, setDetectedBrowsers] = useState<string[]>([]);

  useEffect(() => {
    void detectInstalledBrowsers()
      .then(setDetectedBrowsers)
      .catch(() => {});
  }, []);

  // First launch: offer the system Downloads folder instead of a disabled button.
  useEffect(() => {
    if (outputDir) return;
    let current = true;
    void downloadDir()
      .then((dir) => {
        if (current && dir) setOutputDirState((now) => now || dir);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [outputDir]);

  const setQuality = useCallback((value: Quality) => {
    setQualityState(value);
    saveQuality(value);
  }, []);
  const setAudioOnly = useCallback((value: boolean) => {
    setAudioOnlyState(value);
    saveAudioOnly(value);
  }, []);
  const setPlaylistEnd = useCallback((value: number) => {
    setPlaylistEndState(value);
    savePlaylistEnd(value);
  }, []);
  const setCookiesChoice = useCallback((value: CookiesChoice) => {
    setCookiesChoiceState(value);
    saveCookiesChoice(value);
  }, []);
  const setOutputDir = useCallback((dir: string) => {
    setOutputDirState(dir);
    saveOutputDir(dir);
  }, []);

  return {
    quality,
    setQuality,
    audioOnly,
    setAudioOnly,
    playlistEnd,
    setPlaylistEnd,
    cookiesChoice,
    setCookiesChoice,
    outputDir,
    setOutputDir,
    detectedBrowsers,
  };
}
