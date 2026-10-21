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

const optionRow: React.CSSProperties = { padding: '14px 15px' };
const separator: React.CSSProperties = { height: 1, background: 'rgba(255,255,255,0.06)' };

export function FetchedView({ flow }: { flow: Flow }) {
  const t = useT();
  const { info, plInfo, isPlaylist, isBusy, selectedPlaylistUrls, dl } = flow;

  return (
    <div className="lsv-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto', paddingBottom: 22 }}>
      <UrlInput onSubmit={flow.handleFetchInfo} isLoading={flow.isFetching} showTryChips={false} />
      {flow.fetchError && <div style={{ fontSize: '11.5px', color: 'var(--danger)', userSelect: 'text' }}>{t(flow.fetchError)}</div>}
      {dl.status === 'error' && dl.error && (
        <div role="alert" style={{ fontSize: '12px', color: 'var(--danger)', userSelect: 'text' }}>
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

      <div style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={optionRow}>
          <FormatSelector
            audioOnly={flow.audioOnly}
            onAudioOnlyChange={flow.setAudioOnly}
            quality={flow.quality}
            onQualityChange={flow.setQuality}
            disabled={isBusy}
          />
        </div>
        <div style={separator} />
        <div style={optionRow}>
          <FolderPicker value={flow.outputDir} onChange={flow.setOutputDir} disabled={isBusy} />
        </div>
        <div style={separator} />
        <div style={optionRow}>
          <BrowserCookieSelector
            value={flow.cookiesBrowser}
            onChange={flow.setCookiesBrowser}
            disabled={isBusy}
            detectedBrowsers={flow.detectedBrowsers}
          />
        </div>
        {isPlaylist && selectedPlaylistUrls.length === 0 && (
          <>
            <div style={separator} />
            <div style={optionRow}>
              <PlaylistEndSelector value={flow.playlistEnd} onChange={flow.setPlaylistEnd} disabled={isBusy} />
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
