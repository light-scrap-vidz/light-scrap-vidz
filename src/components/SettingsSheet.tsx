import { useState, useCallback, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import { Spinner } from '@/components/Spinner';
import { getInstallKind, updateYtDlp } from '@/lib/tauri-commands';
import type { CookiesBrowser } from '@/types';
import type { InstallKind } from '@/lib/tauri-commands';
import { useLang, useT } from '@/lib/locale';
import type { Lang } from '@/lib/i18n';
import { loadNotify, saveNotify } from '@/lib/notify';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  cookiesBrowser: CookiesBrowser;
  onCookiesBrowserChange: (v: CookiesBrowser) => void;
  detectedBrowsers: string[];
}

const RELEASES_URL = 'https://github.com/light-scrap-vidz/light-scrap-vidz/releases/latest';

type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'up-to-date'
  | 'error';

const sectionLabel =
  'text-[11px] font-[700] uppercase tracking-[0.06em] text-dim mt-[14px] mb-[2px]';

const card = 'bg-surface rounded-[11px] border border-[rgba(255,255,255,0.06)] p-[13px]';

export function SettingsSheet({
  open: isOpen,
  onClose,
  outputDir,
  onOutputDirChange,
  cookiesBrowser,
  onCookiesBrowserChange,
  detectedBrowsers,
}: SettingsSheetProps) {
  const t = useT();
  const { lang, setLang } = useLang();
  const [notif, setNotif] = useState(loadNotify);
  const [version, setVersion] = useState('');
  const [installKind, setInstallKind] = useState<InstallKind | null>(null);
  const pendingUpdate = useRef<Update | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [ytdlpStatus, setYtdlpStatus] = useState<'idle' | 'updating' | 'updated' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    if (isOpen && !version) {
      void getVersion()
        .then(setVersion)
        .catch(() => {});
      void getInstallKind()
        .then(setInstallKind)
        .catch(() => setInstallKind('deb'));
    }
  }, [isOpen, version]);

  const handleCheckUpdate = useCallback(async () => {
    setUpdateState('checking');
    setUpdateError(null);
    setUpdateVersion(null);
    setYtdlpStatus('updating');
    // yt-dlp refreshes in the background; it does not hold up the app update check.
    void updateYtDlp()
      .then(() => setYtdlpStatus('updated'))
      .catch(() => setYtdlpStatus('failed'));
    try {
      const update = await check();
      if (!update?.available) {
        setUpdateState('up-to-date');
        return;
      }
      pendingUpdate.current = update;
      setUpdateVersion(update.version);
      setUpdateState('available');
    } catch (e) {
      setUpdateState('error');
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Second step, after the user saw the version and confirmed by clicking again.
  const handleInstallUpdate = useCallback(async () => {
    const update = pendingUpdate.current;
    if (!update) return;
    setUpdateError(null);
    try {
      // deb/rpm: no signed in-app update path, so send the user to the release page
      if (installKind === 'deb' || installKind === 'rpm') {
        await openUrl(RELEASES_URL);
        return;
      }

      // macOS app bundle and AppImage: download and install in place
      setUpdateState('downloading');
      setDownloadProgress(0);
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (total > 0) setDownloadProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === 'Finished') {
          setDownloadProgress(100);
        }
      });
      setUpdateState('installing');
      await relaunch();
    } catch (e) {
      setUpdateState('error');
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  }, [installKind]);

  const handlePickFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === 'string' && selected) {
      onOutputDirChange(selected);
    }
  }, [onOutputDirChange]);

  const updateLabel = () => {
    switch (updateState) {
      case 'checking':
        return t('update.checking');
      case 'downloading':
        return downloadProgress > 0
          ? t('update.downloadingPct', { percent: downloadProgress })
          : t('update.downloading');
      case 'installing':
        return t('update.installing');
      case 'up-to-date':
        return t('update.upToDate');
      case 'error':
        return t('update.retry');
      case 'available':
        return updateVersion
          ? t('update.availableTo', { version: updateVersion })
          : t('update.available');
      default:
        return t('update.check');
    }
  };

  const isUpdating =
    updateState === 'checking' || updateState === 'downloading' || updateState === 'installing';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(0,0,0,0.55)] z-[40]" />

      {/* Panel */}
      <div className="absolute top-0 right-0 w-[330px] h-full bg-[#161512] border-l border-l-[rgba(255,255,255,0.09)] [box-shadow:-24px_0_60px_rgba(0,0,0,0.5)] p-[20px] flex flex-col gap-[6px] z-[41] overflow-y-auto [animation:lsv-fade_0.18s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-[700] text-fg-strong">{t('set.title')}</span>
          <button
            onClick={onClose}
            aria-label={t('set.close')}
            className="w-[30px] h-[30px] rounded-[8px] bg-surface-2 border-0 cursor-pointer flex items-center justify-center text-hover"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* DOWNLOADS section */}
        <div className={sectionLabel}>{t('set.downloads')}</div>

        <div className={card}>
          <div className="text-[12px] text-muted mb-[8px]">{t('set.defaultFolder')}</div>
          <button
            onClick={handlePickFolder}
            className={`lsv-hover-accent flex items-center gap-[8px] w-full bg-transparent border-0 p-[0px] cursor-pointer [transition:all_.15s] ${outputDir ? 'text-fg-soft' : 'text-dim'}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <span className="text-[12.5px] font-mono whitespace-nowrap overflow-hidden text-ellipsis [direction:rtl] text-left">
              <bdi>{outputDir || t('opt.chooseFolder')}</bdi>
            </span>
          </button>
        </div>

        <div className={`${card} flex items-center justify-between`}>
          <div>
            <div className="text-[13px] font-[600] text-fg-soft">{t('set.notify')}</div>
            <div className="text-[11px] text-dim mt-[2px]">{t('set.notifySub')}</div>
          </div>
          <button
            onClick={() => {
              setNotif(!notif);
              saveNotify(!notif);
            }}
            role="switch"
            aria-checked={notif}
            aria-label={t('set.notifyAria')}
            className={`w-[42px] h-[24px] rounded-full border-0 cursor-pointer relative [transition:all_.15s] shrink-0 ${notif ? 'bg-accent' : 'bg-surface-2'}`}
          >
            <span
              className={`absolute top-[3px] w-[18px] h-[18px] rounded-full [transition:all_.15s] ${notif ? 'left-[21px] bg-accent-ink' : 'left-[3px] bg-muted'}`}
            />
          </button>
        </div>

        {/* AUTHENTICATION section */}
        <div className={sectionLabel}>{t('set.auth')}</div>

        <div className={card}>
          <div className="text-[12px] text-muted mb-[9px]">{t('set.authSub')}</div>
          <BrowserCookieSelector
            value={cookiesBrowser}
            onChange={onCookiesBrowserChange}
            detectedBrowsers={detectedBrowsers}
          />
        </div>

        {/* LANGUAGE section */}
        <div className={sectionLabel}>{t('set.language')}</div>

        <div className={card}>
          <div className="flex gap-[6px]">
            {(
              [
                { value: 'en', label: 'English' },
                { value: 'fr', label: 'Français' },
              ] as { value: Lang; label: string }[]
            ).map((opt) => {
              const active = lang === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  aria-pressed={active}
                  className={`[padding:5px_11px] rounded-[8px] cursor-pointer text-[12.5px] font-[600] [transition:all_.15s] ${active ? 'bg-accent text-accent-ink border border-transparent' : 'bg-surface-2 text-chip border border-[rgba(255,255,255,0.10)]'}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ABOUT section */}
        <div className={sectionLabel}>{t('set.about')}</div>

        <div className={card}>
          {/* App identity */}
          <div className="flex items-center gap-[10px] mb-[12px]">
            <div className="w-[32px] h-[32px] rounded-[9px] bg-accent flex items-center justify-center text-accent-ink shrink-0">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M12 4v11" />
                <path d="M7 11l5 5 5-5" />
                <path d="M5 20h14" />
              </svg>
            </div>
            <div>
              <div className="text-[13px] font-[700] text-fg-strong">light-scrap-vidz</div>
              <div className="text-[11.5px] font-mono text-dim mt-[1px]">
                {version ? `v${version}` : '…'}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="h-[1px] bg-[rgba(255,255,255,0.06)] mb-[12px]" />

          {/* Update button */}
          <button
            onClick={() => {
              if (isUpdating) return;
              void (updateState === 'available' ? handleInstallUpdate() : handleCheckUpdate());
            }}
            disabled={isUpdating}
            className={`lsv-hover-outline w-full h-[38px] rounded-[9px] text-[13px] font-[600] flex items-center justify-center gap-[8px] [transition:all_.15s] relative overflow-hidden ${`border ${updateState === 'up-to-date' ? 'border-[rgba(201,242,94,0.25)] text-accent' : updateState === 'error' ? 'border-[rgba(255,138,138,0.25)] text-danger' : 'border-[rgba(255,255,255,0.10)] text-fg-soft'} ${isUpdating ? 'bg-[rgba(201,242,94,0.06)] cursor-default' : 'bg-surface-2 cursor-pointer'}`}`}
          >
            {/* Download progress bar */}
            {updateState === 'downloading' && downloadProgress > 0 && (
              <div
                className="absolute left-0 top-0 h-full bg-[rgba(201,242,94,0.12)] [transition:width_0.3s]"
                style={{ width: `${downloadProgress}%` }}
              />
            )}

            {isUpdating ? (
              <Spinner size={14} thickness={2} />
            ) : updateState === 'up-to-date' ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            <span className="relative">{updateLabel()}</span>
          </button>

          {/* yt-dlp status */}
          {ytdlpStatus !== 'idle' && (
            <div className="flex items-center gap-[6px] mt-[8px]">
              {ytdlpStatus === 'updating' && <Spinner size={10} thickness={1.5} />}
              {ytdlpStatus === 'updated' && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C9F25E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {ytdlpStatus === 'failed' && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FF8A8A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              )}
              <span
                className={`text-[11px] ${ytdlpStatus === 'failed' ? 'text-danger' : 'text-dim'}`}
              >
                {ytdlpStatus === 'updating' && t('ytdlp.updating')}
                {ytdlpStatus === 'updated' && t('ytdlp.updated')}
                {ytdlpStatus === 'failed' && t('ytdlp.failed')}
              </span>
            </div>
          )}

          {/* Error message */}
          {updateState === 'error' && updateError && (
            <div className="text-[11px] text-danger mt-[8px] [line-height:1.4]">{updateError}</div>
          )}
        </div>
      </div>
    </>
  );
}
