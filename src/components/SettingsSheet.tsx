import { useState, useCallback, useEffect, useRef } from 'react';
import { pickFolder } from '@/lib/pick-folder';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import type { CookiesChoice } from '@/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useT } from '@/lib/locale';
import { loadNotify, saveNotify } from '@/lib/notify';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  cookiesChoice: CookiesChoice;
  onCookiesChoiceChange: (v: CookiesChoice) => void;
  detectedBrowsers: string[];
}

const sectionLabel =
  'text-[11px] font-[700] uppercase tracking-[0.06em] text-dim mt-[14px] mb-[2px]';

const card =
  'bg-surface rounded-[11px] border border-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] p-[13px]';

export function SettingsSheet({
  open: isOpen,
  onClose,
  outputDir,
  onOutputDirChange,
  cookiesChoice,
  onCookiesChoiceChange,
  detectedBrowsers,
}: SettingsSheetProps) {
  const t = useT();
  const [notif, setNotif] = useState(loadNotify);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, isOpen);

  const handlePickFolder = useCallback(async () => {
    const selected = await pickFolder();
    if (selected) onOutputDirChange(selected);
  }, [onOutputDirChange]);

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
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(0,0,0,0.55)] z-[40]"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        className="absolute top-0 right-0 w-[330px] h-full bg-surface border-l border-l-[color-mix(in_srgb,var(--text-primary)_9%,transparent)] [box-shadow:-24px_0_60px_rgba(0,0,0,0.5)] p-[20px] flex flex-col gap-[6px] z-[41] overflow-y-auto [animation:lsv-fade_0.18s_ease] [outline:none]"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span id="settings-title" className="text-[16px] font-[700] text-fg-strong">
            {t('set.title')}
          </span>
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
            value={cookiesChoice}
            onChange={onCookiesChoiceChange}
            detectedBrowsers={detectedBrowsers}
          />
        </div>
      </div>
    </>
  );
}
