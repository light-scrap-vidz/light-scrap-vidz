import { useT } from '@/lib/locale';

interface DownloadButtonProps {
  disabled?: boolean;
  audioOnly?: boolean;
  isPlaylist?: boolean;
  playlistCount?: number | null;
  selectedCount?: number;
  onDownload: () => void;
}

export function DownloadButton({
  disabled,
  audioOnly,
  isPlaylist,
  playlistCount,
  selectedCount,
  onDownload,
}: DownloadButtonProps) {
  const t = useT();

  let label: string;
  if (isPlaylist && selectedCount && selectedCount > 0) {
    label = t(audioOnly ? 'dl.selectedAudio' : 'dl.selectedVideo', { count: selectedCount });
  } else if (isPlaylist) {
    label = t(audioOnly ? 'dl.playlistAudio' : 'dl.playlistVideo', { count: playlistCount ?? 0 });
  } else {
    label = t(audioOnly ? 'dl.mp3' : 'dl.mp4');
  }

  return (
    <button
      onClick={onDownload}
      disabled={disabled}
      style={{
        width: '100%',
        height: 56,
        borderRadius: 14,
        border: 'none',
        background: '#C9F25E',
        color: '#14140C',
        fontSize: '15.5px',
        fontWeight: 700,
        fontFamily: "'Hanken Grotesk', sans-serif",
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        boxShadow: '0 10px 28px rgba(201,242,94,0.32)',
        transition: 'all .15s',
      }}
      onMouseEnter={(e) => { if (!disabled) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)'; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.filter = 'none'; }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" />
        <path d="M7 11l5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {label}
    </button>
  );
}
