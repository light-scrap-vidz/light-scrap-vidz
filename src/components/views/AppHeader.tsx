import { useT } from '@/lib/locale';

interface AppHeaderProps {
  showBack: boolean;
  backDisabled: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
}

const iconButton =
  'lsv-hover-icon w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer flex items-center justify-center text-muted transition-all duration-150 shrink-0 disabled:cursor-default';

export function AppHeader({ showBack, backDisabled, onBack, onOpenSettings }: AppHeaderProps) {
  const t = useT();
  return (
    <div className="h-[46px] shrink-0 flex items-center [padding:0_16px] border-b border-b-[rgba(255,255,255,0.06)] relative">
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

      <div className="absolute left-1/2 top-1/2 [transform:translate(-50%,-50%)] flex items-center gap-[9px]">
        <div className="w-[22px] h-[22px] rounded-[7px] bg-accent flex items-center justify-center text-accent-ink">
          <svg
            width="13"
            height="13"
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
        <span className="text-[13.5px] font-[700] [letter-spacing:-0.01em] text-[#EFEBE4]">
          light-scrap-vidz
        </span>
      </div>

      <button
        onClick={onOpenSettings}
        className={`${iconButton} ml-auto`}
        aria-label={t('header.settings')}
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
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
