import type { CookiesBrowser } from '@/types';
import { useT } from '@/lib/locale';

const ALL_OPTIONS: { value: CookiesBrowser; labelKey: string; browser: string | null }[] = [
  { value: null, labelKey: 'opt.cookiesNone', browser: null },
  { value: 'firefox', labelKey: 'Firefox', browser: 'firefox' },
  { value: 'chrome', labelKey: 'Chrome', browser: 'chrome' },
  { value: 'chromium', labelKey: 'Chromium', browser: 'chromium' },
];

interface BrowserCookieSelectorProps {
  value: CookiesBrowser;
  onChange: (v: CookiesBrowser) => void;
  disabled?: boolean;
  detectedBrowsers?: string[];
}

export function BrowserCookieSelector({
  value,
  onChange,
  disabled,
  detectedBrowsers,
}: BrowserCookieSelectorProps) {
  const t = useT();
  const options =
    detectedBrowsers && detectedBrowsers.length > 0
      ? ALL_OPTIONS.filter((o) => o.browser === null || detectedBrowsers.includes(o.browser))
      : ALL_OPTIONS;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#C2BCB2', flexShrink: 0 }}>{t('opt.signIn')}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.labelKey}
              onClick={() => onChange(opt.value)}
              disabled={disabled}
              style={{
                padding: '5px 11px',
                borderRadius: 8,
                cursor: disabled ? 'default' : 'pointer',
                fontSize: '12.5px',
                fontWeight: 600,
                background: active ? '#C9F25E' : '#211F1B',
                color: active ? '#14140C' : '#B6B0A6',
                border: active ? '1px solid transparent' : '1px solid rgba(255,255,255,0.10)',
                transition: 'all .15s',
              }}
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
