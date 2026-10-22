import { UrlInput } from '@/components/UrlInput';
import { VideoPreview } from '@/components/VideoPreview';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import { FormatSelector } from '@/components/FormatSelector';
import { PlaylistEndSelector } from '@/components/PlaylistEndSelector';
import { FolderPicker } from '@/components/FolderPicker';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import { DownloadButton } from '@/components/DownloadButton';
import { useT } from '@/lib/locale';
import type { Flow } from '@/hooks/useAppFlow';

const optionRow = 'p-[14px_15px]';
const separator = 'h-px bg-[rgba(255,255,255,0.06)]';

export function FetchedView({ flow }: { flow: Flow }) {
  const t = useT();
  const { info, plInfo, isPlaylist, isBusy, selectedPlaylistUrls, dl } = flow;

  return (
    <div className="lsv-view flex-1 flex flex-col gap-[14px] overflow-auto [padding-bottom:22px]">
      <UrlInput onSubmit={flow.handleFetchInfo} isLoading={flow.isFetching} showTryChips={false} />
      {flow.fetchError && (
        <div className="text-[11.5px] text-danger select-text">{t(flow.fetchError)}</div>
      )}
      {dl.status === 'error' && dl.error && (
        <div role="alert" className="text-[12px] text-danger select-text">
          {t(dl.error)}
        </div>
      )}

      {flow.urlKind === 'single' && info && <VideoPreview info={info} url={flow.url} />}
      {isPlaylist && plInfo && (
        <PlaylistPreview
          info={plInfo}
          url={flow.url}
          selectedUrls={selectedPlaylistUrls}
          onSelectionChange={flow.setSelectedPlaylistUrls}
          disabled={isBusy}
        />
      )}

      <div className="bg-surface border border-[rgba(255,255,255,0.07)] rounded-[14px] overflow-hidden">
        <div className={optionRow}>
          <FormatSelector
            audioOnly={flow.audioOnly}
            onAudioOnlyChange={flow.setAudioOnly}
            quality={flow.quality}
            onQualityChange={flow.setQuality}
            disabled={isBusy}
          />
        </div>
        <div className={separator} />
        <div className={optionRow}>
          <FolderPicker value={flow.outputDir} onChange={flow.setOutputDir} disabled={isBusy} />
        </div>
        <div className={separator} />
        <div className={optionRow}>
          <BrowserCookieSelector
            value={flow.cookiesBrowser}
            onChange={flow.setCookiesBrowser}
            disabled={isBusy}
            detectedBrowsers={flow.detectedBrowsers}
          />
        </div>
        {isPlaylist && selectedPlaylistUrls.length === 0 && (
          <>
            <div className={separator} />
            <div className={optionRow}>
              <PlaylistEndSelector
                value={flow.playlistEnd}
                onChange={flow.setPlaylistEnd}
                disabled={isBusy}
              />
            </div>
          </>
        )}
      </div>

      <DownloadButton
        disabled={!flow.outputDir || isBusy}
        audioOnly={flow.audioOnly}
        isPlaylist={isPlaylist}
        playlistCount={flow.playlistCount}
        selectedCount={selectedPlaylistUrls.length}
        onDownload={flow.handleDownload}
      />
    </div>
  );
}
