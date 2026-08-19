import { useState, useCallback } from 'react';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { useT } from '@/lib/locale';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  showTryChips?: boolean;
}

const SUPPORTED_PLATFORMS: { label: string; dot: string }[] = [
  { label: 'YouTube',     dot: '#FF3B30' },
  { label: 'TikTok',      dot: '#25F4EE' },
  { label: 'Instagram',   dot: '#E1306C' },
  { label: 'Facebook',    dot: '#1877F2' },
  { label: 'Twitter / X', dot: '#1DA1F2' },
  { label: 'Twitch',      dot: '#9146FF' },
  { label: 'Vimeo',       dot: '#1AB7EA' },
  { label: 'Dailymotion', dot: '#FF7300' },
];

export function UrlInput({ onSubmit, isLoading, disabled, showTryChips }: UrlInputProps) {
  const t = useT();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(() => {
    const url = value.trim();
    if (!url) return;
    onSubmit(url);
  }, [value, onSubmit]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await readText();
      if (text) setValue(text.trim());
    } catch {
      // clipboard access denied
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit],
  );

  const inputDisabled = disabled || isLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Input */}
        <div
          style={{
            flex: 1,
            height: 54,
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '0 16px',
            background: '#1E1D18',
            borderRadius: 13,
            border: `1px solid ${focused ? '#C9F25E' : 'rgba(255,255,255,0.08)'}`,
            transition: 'all .15s',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#857F75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={t('url.placeholder')}
            disabled={inputDisabled}
            aria-label={t('url.aria')}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#EAE6DF',
              fontSize: '14px',
              fontFamily: "'Hanken Grotesk', sans-serif",
            }}
          />
        </div>

        {/* Paste button */}
        <button
          onClick={handlePaste}
          disabled={inputDisabled}
          aria-label={t('url.paste')}
          title={t('url.paste')}
          style={{
            width: 54,
            height: 54,
            flexShrink: 0,
            borderRadius: 13,
            background: '#211F1B',
            border: '1px solid rgba(255,255,255,0.10)',
            cursor: inputDisabled ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#A39D93',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => { if (!inputDisabled) (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.20)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.10)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          </svg>
        </button>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={inputDisabled || !value.trim()}
          aria-label={t('url.fetch')}
          style={{
            width: 54,
            height: 54,
            flexShrink: 0,
            borderRadius: 13,
            background: '#C9F25E',
            border: 'none',
            cursor: inputDisabled || !value.trim() ? 'default' : 'pointer',
            opacity: !value.trim() ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#14140C',
            boxShadow: '0 6px 20px rgba(201,242,94,0.32)',
            transition: 'all .15s',
          }}
          onMouseEnter={(e) => { if (!inputDisabled && value.trim()) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)'; } }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
        >
          {isLoading ? (
            <span
              className="lsv-spin"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2.5px solid rgba(20,20,12,0.3)',
                borderTopColor: '#14140C',
                display: 'inline-block',
              }}
            />
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>

      {showTryChips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '11.5px', color: '#5C574F', fontWeight: 500, marginRight: 2 }}>{t('url.supports')}</span>
          {SUPPORTED_PLATFORMS.map((p) => (
            <span
              key={p.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                background: '#1A1916',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 7,
                color: '#857F75',
                fontSize: '11px',
                fontWeight: 600,
                userSelect: 'none',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.dot, flexShrink: 0, opacity: 0.85 }} />
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
