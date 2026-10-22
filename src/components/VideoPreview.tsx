import { formatDuration } from '@/lib/utils';
import { getPlatform } from '@/lib/url-validator';
import type { VideoInfo } from '@/types';
import { useT } from '@/lib/locale';
import { PlatformBadge } from './PlatformBadge';
import { Thumb } from './Thumb';

interface VideoPreviewProps {
  info: VideoInfo;
  url: string;
}

export function VideoPreview({ info, url }: VideoPreviewProps) {
  const t = useT();
  const platform = getPlatform(url);

  return (
    <div className="flex gap-[15px] p-[15px] bg-surface border border-[rgba(255,255,255,0.07)] rounded-[14px]">
      {/* Thumbnail */}
      <div className="relative shrink-0 w-[124px] h-[78px] rounded-[9px] overflow-hidden">
        <Thumb src={info.thumbnail} alt={info.title} platform={platform} />
        {info.duration > 0 && (
          <span className="absolute bottom-[5px] right-[5px] bg-[rgba(0,0,0,0.72)] text-fg-strong text-[9.5px] font-mono font-[500] [padding:1px_5px] rounded-[5px]">
            {formatDuration(info.duration)}
          </span>
        )}
      </div>

      {/* Right column */}
      <div className="flex-1 min-w-[0px] flex flex-col gap-[7px]">
        <div className="flex items-center gap-[9px]">
          <PlatformBadge platform={platform} />
          <span className="text-[11px] font-[600] [text-transform:uppercase] [letter-spacing:0.04em] text-muted">
            {t('preview.single')}
          </span>
        </div>

        <h3 className="m-0 text-[15.5px] font-[700] text-fg-strong [letter-spacing:-0.01em] [line-height:1.25] [display:-webkit-box] [-webkit--line-clamp:2] [-webkit--box-orient:vertical] overflow-hidden">
          {info.title}
        </h3>

        <div className="text-[12.5px] font-mono text-muted">
          {[info.uploader, info.duration > 0 ? formatDuration(info.duration) : null]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
    </div>
  );
}
