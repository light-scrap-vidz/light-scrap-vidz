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
      className={`lsv-hover-lift w-full h-[56px] rounded-[14px] border-0 bg-accent text-accent-ink text-[15.5px] font-[700] font-sans flex items-center justify-center gap-[10px] [box-shadow:0_10px_28px_rgba(201,242,94,0.32)] [transition:all_.15s] ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
      disabled={disabled}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v12" />
        <path d="M7 11l5 5 5-5" />
        <path d="M5 21h14" />
      </svg>
      {label}
    </button>
  );
}
