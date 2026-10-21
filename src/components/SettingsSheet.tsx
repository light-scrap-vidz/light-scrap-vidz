import { useState, useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import { getInstallKind, downloadDebUpdate, installDebUpdate, updateYtDlp } from '@/lib/tauri-commands';
import type { CookiesBrowser } from '@/types';
import { useLang, useT } from '@/lib/locale';
import type { Lang } from '@/lib/i18n';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  cookiesBrowser: CookiesBrowser;
  onCookiesBrowserChange: (v: CookiesBrowser) => void;
  detectedBrowsers: string[];
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6F6960',
  marginTop: 14,
  marginBottom: 2,
};

const cardStyle: React.CSSProperties = {
  background: '#1A1916',
  borderRadius: 11,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 13,
};

export function SettingsButton({
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
  const [notif, setNotif] = useState(true);
  const [version, setVersion] = useState('');
  const [installKind, setInstallKind] = useState<'appimage' | 'deb' | null>(null);
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
    try {
      // Update yt-dlp silently while checking for app update
      await updateYtDlp()
        .then(() => setYtdlpStatus('updated'))
        .catch(() => setYtdlpStatus('failed'));

      const update = await check();
      if (!update?.available) {
        setUpdateState('up-to-date');
        return;
      }
      setUpdateVersion(update.version);

      // deb: download .deb then pkexec dpkg -i (shows system password dialog)
      if (installKind !== 'appimage') {
        setUpdateState('downloading');
        setDownloadProgress(0);
        await downloadDebUpdate(update.version);
        setUpdateState('installing');
        await installDebUpdate(update.version);
        await relaunch();
        return;
      }

      // AppImage: download and install in-place
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
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#F1EDE6' }}>{t('set.title')}</span>
          <button
            onClick={onClose}
            aria-label={t('set.close')}
            style={{
              width: 30, height: 30, borderRadius: 8, background: '#211F1B', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A39D93',
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
          <div style={{ fontSize: '12px', color: '#857F75', marginBottom: 8 }}>{t('set.defaultFolder')}</div>
          <button
            onClick={handlePickFolder}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              color: outputDir ? '#D6D1C8' : '#6F6960', transition: 'all .15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#C9F25E'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = outputDir ? '#D6D1C8' : '#6F6960'; }}
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
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#D6D1C8' }}>{t('set.notify')}</div>
            <div style={{ fontSize: '11px', color: '#6F6960', marginTop: 2 }}>{t('set.notifySub')}</div>
          </div>
          <button
            onClick={() => setNotif((v) => !v)}
            aria-label={t('set.notifyAria')}
            style={{
              width: 42, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
              background: notif ? '#C9F25E' : '#211F1B', position: 'relative', transition: 'all .15s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: notif ? 21 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: notif ? '#14140C' : '#857F75', transition: 'all .15s',
            }} />
          </button>
        </div>

        {/* AUTHENTICATION section */}
        <div style={sectionLabelStyle}>{t('set.auth')}</div>

        <div style={cardStyle}>
          <div style={{ fontSize: '12px', color: '#857F75', marginBottom: 9 }}>{t('set.authSub')}</div>
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
                  style={{
                    padding: '5px 11px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: active ? '#C9F25E' : '#211F1B',
                    color: active ? '#14140C' : '#B6B0A6',
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
              width: 32, height: 32, borderRadius: 9, background: '#C9F25E',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14140C', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 4v11" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#F1EDE6' }}>light-scrap-vidz</div>
              <div style={{ fontSize: '11.5px', fontFamily: "'JetBrains Mono', monospace", color: '#6F6960', marginTop: 1 }}>
                {version ? `v${version}` : '…'}
              </div>
            </div>
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

          {/* Update button */}
          <button
            onClick={() => { if (!isUpdating) void handleCheckUpdate(); }}
            disabled={isUpdating}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 9,
              border: `1px solid ${updateState === 'up-to-date' ? 'rgba(201,242,94,0.25)' : updateState === 'error' ? 'rgba(255,138,138,0.25)' : 'rgba(255,255,255,0.10)'}`,
              background: isUpdating ? 'rgba(201,242,94,0.06)' : '#211F1B',
              color: updateState === 'up-to-date' ? '#C9F25E' : updateState === 'error' ? '#FF8A8A' : '#D6D1C8',
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
            onMouseEnter={(e) => { if (!isUpdating) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.20)'; }}
            onMouseLeave={(e) => { if (!isUpdating) (e.currentTarget as HTMLButtonElement).style.borderColor = updateState === 'error' ? 'rgba(255,138,138,0.25)' : 'rgba(255,255,255,0.10)'; }}
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
              <span
                className="lsv-spin"
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(201,242,94,0.3)',
                  borderTopColor: '#C9F25E',
                  display: 'inline-block', flexShrink: 0,
                }}
              />
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
                <span className="lsv-spin" style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(201,242,94,0.3)', borderTopColor: '#C9F25E', display: 'inline-block', flexShrink: 0 }} />
              )}
              {ytdlpStatus === 'updated' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C9F25E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              )}
              {ytdlpStatus === 'failed' && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FF8A8A" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              )}
              <span style={{ fontSize: '11px', color: ytdlpStatus === 'failed' ? '#FF8A8A' : '#6F6960' }}>
                {ytdlpStatus === 'updating' && t('ytdlp.updating')}
                {ytdlpStatus === 'updated' && t('ytdlp.updated')}
                {ytdlpStatus === 'failed' && t('ytdlp.failed')}
              </span>
            </div>
          )}

          {/* Error message */}
          {updateState === 'error' && updateError && (
            <div style={{ fontSize: '11px', color: '#FF8A8A', marginTop: 8, lineHeight: 1.4 }}>
              {updateError}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
