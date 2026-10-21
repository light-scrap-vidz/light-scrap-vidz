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

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-dim)',
  marginTop: 14,
  marginBottom: 2,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 11,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 13,
};

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
  const [ytdlpStatus, setYtdlpStatus] = useState<'idle' | 'updating' | 'updated' | 'failed'>('idle');

  useEffect(() => {
    if (isOpen && !version) {
      void getVersion().then(setVersion).catch(() => {});
      void getInstallKind().then(setInstallKind).catch(() => setInstallKind('deb'));
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
      case 'checking': return t('update.checking');
      case 'downloading':
        return downloadProgress > 0
          ? t('update.downloadingPct', { percent: downloadProgress })
          : t('update.downloading');
      case 'installing': return t('update.installing');
      case 'up-to-date': return t('update.upToDate');
      case 'error': return t('update.retry');
      case 'available':
        return updateVersion ? t('update.availableTo', { version: updateVersion }) : t('update.available');
      default: return t('update.check');
    }
  };

  const isUpdating = updateState === 'checking' || updateState === 'downloading' || updateState === 'installing';

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
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 330,
          height: '100%',
          background: '#161512',
          borderLeft: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '-24px 0 60px rgba(0,0,0,0.5)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          zIndex: 41,
          overflowY: 'auto',
          animation: 'lsv-fade 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-strong)' }}>{t('set.title')}</span>
          <button
            onClick={onClose}
            aria-label={t('set.close')}
            style={{
              width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-hover)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* DOWNLOADS section */}
        <div style={sectionLabelStyle}>{t('set.downloads')}</div>

        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 8 }}>{t('set.defaultFolder')}</div>
          <button
            onClick={handlePickFolder}
            className="lsv-hover-accent"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              color: outputDir ? 'var(--text-soft)' : 'var(--text-dim)', transition: 'all .15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
            <span style={{ fontSize: '12.5px', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', direction: 'rtl', textAlign: 'left' }}>
              {outputDir || t('opt.chooseFolder')}
            </span>
          </button>
        </div>

        <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-soft)' }}>{t('set.notify')}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: 2 }}>{t('set.notifySub')}</div>
          </div>
          <button
            onClick={() => {
              setNotif(!notif);
              saveNotify(!notif);
            }}
            role="switch"
            aria-checked={notif}
            aria-label={t('set.notifyAria')}
            style={{
              width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: notif ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'all .15s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: notif ? 21 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: notif ? 'var(--accent-ink)' : 'var(--text-muted)', transition: 'all .15s',
            }} />
          </button>
        </div>

        {/* AUTHENTICATION section */}
        <div style={sectionLabelStyle}>{t('set.auth')}</div>

        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 9 }}>{t('set.authSub')}</div>
          <BrowserCookieSelector
            value={cookiesBrowser}
            onChange={onCookiesBrowserChange}
            detectedBrowsers={detectedBrowsers}
          />
        </div>

        {/* LANGUAGE section */}
        <div style={sectionLabelStyle}>{t('set.language')}</div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
            ] as { value: Lang; label: string }[]).map((opt) => {
              const active = lang === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setLang(opt.value)}
                  aria-pressed={active}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? 'var(--accent-ink)' : 'var(--text-chip)',
                    border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.10)',
                    transition: 'all .15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ABOUT section */}
        <div style={sectionLabelStyle}>{t('set.about')}</div>

        <div style={cardStyle}>
          {/* App identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-strong)' }}>light-scrap-vidz</div>
              <div style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)', marginTop: 1 }}>
                {version ? `v${version}` : '…'}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

          {/* Update button */}
          <button
            onClick={() => {
              if (isUpdating) return;
              void (updateState === 'available' ? handleInstallUpdate() : handleCheckUpdate());
            }}
            disabled={isUpdating}
            className="lsv-hover-outline"
            style={{
              width: '100%',
              height: 38,
              borderRadius: 9,
              border: `1px solid ${updateState === 'up-to-date' ? 'rgba(201,242,94,0.25)' : updateState === 'error' ? 'rgba(255,138,138,0.25)' : 'rgba(255,255,255,0.10)'}`,
              background: isUpdating ? 'rgba(201,242,94,0.06)' : 'var(--surface-2)',
              color: updateState === 'up-to-date' ? 'var(--accent)' : updateState === 'error' ? 'var(--danger)' : 'var(--text-soft)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isUpdating ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all .15s',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Download progress bar */}
            {updateState === 'downloading' && downloadProgress > 0 && (
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${downloadProgress}%`,
                background: 'rgba(201,242,94,0.12)',
                transition: 'width 0.3s',
              }} />
            )}

            {isUpdating ? (
              <Spinner size={14} thickness={2} />
            ) : updateState === 'up-to-date' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            <span style={{ position: 'relative' }}>{updateLabel()}</span>
          </button>

          {/* yt-dlp status */}
          {ytdlpStatus !== 'idle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              {ytdlpStatus === 'updating' && (
                <Spinner size={10} thickness={1.5} />
              )}
              {ytdlpStatus === 'updated' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C9F25E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
              {ytdlpStatus === 'failed' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF8A8A" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              )}
              <span style={{ fontSize: '11px', color: ytdlpStatus === 'failed' ? 'var(--danger)' : 'var(--text-dim)' }}>
                {ytdlpStatus === 'updating' && t('ytdlp.updating')}
                {ytdlpStatus === 'updated' && t('ytdlp.updated')}
                {ytdlpStatus === 'failed' && t('ytdlp.failed')}
              </span>
            </div>
          )}

          {/* Error message */}
          {updateState === 'error' && updateError && (
            <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: 8, lineHeight: 1.4 }}>
              {updateError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
