import { useT } from '@/lib/locale';

interface AppHeaderProps {
  showBack: boolean;
  backDisabled: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
}

const iconButton: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  transition: 'all .15s',
  flexShrink: 0,
};

export function AppHeader({ showBack, backDisabled, onBack, onOpenSettings }: AppHeaderProps) {
  const t = useT();
  return (
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
      {showBack && (
        <button
          onClick={onBack}
          className="lsv-hover-icon"
          style={iconButton}
          aria-label={t('header.back')}
          disabled={backDisabled}
          title={t(backDisabled ? 'header.backBlocked' : 'header.back')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 4v11" />
            <path d="M7 11l5 5 5-5" />
            <path d="M5 20h14" />
          </svg>
        </div>
        <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#EFEBE4' }}>light-scrap-vidz</span>
      </div>

      <button
        onClick={onOpenSettings}
        className="lsv-hover-icon"
        style={{ ...iconButton, marginLeft: 'auto' }}
        aria-label={t('header.settings')}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h11" />
          <path d="M19 7h1" />
          <path d="M4 17h5" />
          <path d="M13 17h7" />
          <circle cx="16" cy="7" r="2.4" />
          <circle cx="10" cy="17" r="2.4" />
        </svg>
      </button>
    </div>
  );
}
