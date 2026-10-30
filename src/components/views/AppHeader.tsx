import { useT } from '@/lib/locale';

interface AppHeaderProps {
  showBack: boolean;
  backDisabled: boolean;
  onBack: () => void;
}

const iconButton =
  'lsv-hover-icon w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer flex items-center justify-center text-muted transition-all duration-150 shrink-0 disabled:cursor-default';

export function AppHeader({ showBack, backDisabled, onBack }: AppHeaderProps) {
  const t = useT();
  return (
    <div className="h-[46px] shrink-0 flex items-center [padding:0_16px] border-b border-b-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] relative">
      {showBack && (
        <button
          onClick={onBack}
          className={iconButton}
          aria-label={t('header.back')}
          disabled={backDisabled}
          title={t(backDisabled ? 'header.backBlocked' : 'header.back')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
