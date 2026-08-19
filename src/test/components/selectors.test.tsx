import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { open } from '@tauri-apps/plugin-dialog';
import { PlaylistEndSelector } from '@/components/PlaylistEndSelector';
import { BrowserCookieSelector } from '@/components/BrowserCookieSelector';
import { FolderPicker } from '@/components/FolderPicker';
import { DownloadButton } from '@/components/DownloadButton';

const mockOpen = vi.mocked(open);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PlaylistEndSelector', () => {
  it('shows the current value as a string', () => {
    render(<PlaylistEndSelector value={10} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Number of videos to download')).toHaveValue('10');
  });

  it('offers every preset including "All videos"', () => {
    render(<PlaylistEndSelector value={10} onChange={vi.fn()} />);
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Latest 5', 'Latest 10', 'Latest 20', 'Latest 50', 'All videos']);
  });

  it('reports the chosen count as a number', () => {
    const onChange = vi.fn();
    render(<PlaylistEndSelector value={10} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Number of videos to download'), {
      target: { value: '50' },
    });

    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('maps "All videos" to 0', () => {
    const onChange = vi.fn();
    render(<PlaylistEndSelector value={10} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Number of videos to download'), {
      target: { value: '0' },
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('can be disabled', () => {
    render(<PlaylistEndSelector value={10} onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText('Number of videos to download')).toBeDisabled();
  });
});

describe('BrowserCookieSelector', () => {
  it('offers every browser when nothing was detected', () => {
    render(<BrowserCookieSelector value={null} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'None',
      'Firefox',
      'Chrome',
      'Chromium',
    ]);
  });

  it('narrows the list to the detected browsers, always keeping None', () => {
    render(
      <BrowserCookieSelector value={null} onChange={vi.fn()} detectedBrowsers={['firefox']} />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['None', 'Firefox']);
  });

  it('falls back to the full list when the detected array is empty', () => {
    render(<BrowserCookieSelector value={null} onChange={vi.fn()} detectedBrowsers={[]} />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('reports the picked browser', () => {
    const onChange = vi.fn();
    render(<BrowserCookieSelector value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Chrome' }));

    expect(onChange).toHaveBeenCalledWith('chrome');
  });

  it('reports null when None is picked', () => {
    const onChange = vi.fn();
    render(<BrowserCookieSelector value="chrome" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'None' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('highlights the active choice', () => {
    render(<BrowserCookieSelector value="firefox" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Firefox' })).toHaveStyle({
      background: '#C9F25E',
    });
    expect(screen.getByRole('button', { name: 'Chrome' })).toHaveStyle({
      background: '#211F1B',
    });
  });

  it('disables every choice at once', () => {
    render(<BrowserCookieSelector value={null} onChange={vi.fn()} disabled />);
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});

describe('FolderPicker', () => {
  it('prompts when no folder is set yet', () => {
    render(<FolderPicker value="" onChange={vi.fn()} />);
    expect(screen.getByText('Choose folder…')).toBeInTheDocument();
  });

  it('shows the chosen folder', () => {
    render(<FolderPicker value="/home/me/Videos" onChange={vi.fn()} />);
    expect(screen.getByText('/home/me/Videos')).toBeInTheDocument();
  });

  it('opens a directory-only picker and reports the choice', async () => {
    mockOpen.mockResolvedValue('/home/me/Downloads');
    const onChange = vi.fn();
    render(<FolderPicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Choose output folder'));

    expect(mockOpen).toHaveBeenCalledWith({ directory: true, multiple: false });
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('/home/me/Downloads'));
  });

  it('reports nothing when the dialog is dismissed', async () => {
    mockOpen.mockResolvedValue(null);
    const onChange = vi.fn();
    render(<FolderPicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Choose output folder'));
    await vi.waitFor(() => expect(mockOpen).toHaveBeenCalled());

    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports nothing when the dialog returns several paths', async () => {
    mockOpen.mockResolvedValue(['/a', '/b'] as never);
    const onChange = vi.fn();
    render(<FolderPicker value="" onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Choose output folder'));
    await vi.waitFor(() => expect(mockOpen).toHaveBeenCalled());

    expect(onChange).not.toHaveBeenCalled();
  });

  it('tints on hover and restores the colour on leave', () => {
    render(<FolderPicker value="/home/me" onChange={vi.fn()} />);
    const button = screen.getByLabelText('Choose output folder');

    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ color: '#C9F25E' });

    fireEvent.mouseLeave(button);
    expect(button).toHaveStyle({ color: '#D6D1C8' });
  });

  it('does not tint on hover while disabled', () => {
    render(<FolderPicker value="" onChange={vi.fn()} disabled />);
    const button = screen.getByLabelText('Choose output folder');

    fireEvent.mouseEnter(button);

    expect(button).not.toHaveStyle({ color: '#C9F25E' });
  });
});

describe('DownloadButton', () => {
  it.each([
    [{}, 'Download MP4'],
    [{ audioOnly: true }, 'Extract MP3'],
    [{ isPlaylist: true, playlistCount: 12 }, 'Download 12 videos'],
    [{ isPlaylist: true, playlistCount: 12, audioOnly: true }, 'Extract 12 MP3s'],
    [{ isPlaylist: true, playlistCount: null }, 'Download 0 videos'],
    [{ isPlaylist: true, selectedCount: 3 }, 'Download 3 selected'],
    [{ isPlaylist: true, selectedCount: 3, audioOnly: true }, 'Extract 3 selected'],
  ])('labels itself %j as "%s"', (props, expected) => {
    render(<DownloadButton onDownload={vi.fn()} {...props} />);
    expect(screen.getByRole('button')).toHaveTextContent(expected);
  });

  it('falls back to the playlist count when the selection is empty', () => {
    render(
      <DownloadButton onDownload={vi.fn()} isPlaylist playlistCount={7} selectedCount={0} />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Download 7 videos');
  });

  it('triggers the download on click', () => {
    const onDownload = vi.fn();
    render(<DownloadButton onDownload={onDownload} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks and dims itself while disabled', () => {
    const onDownload = vi.fn();
    render(<DownloadButton onDownload={onDownload} disabled />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    expect(onDownload).not.toHaveBeenCalled();
    expect(button).toHaveStyle({ opacity: '0.5' });
  });

  it('lifts on hover and settles back on leave', () => {
    render(<DownloadButton onDownload={vi.fn()} />);
    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);
    expect(button).toHaveStyle({ transform: 'translateY(-1px)' });

    fireEvent.mouseLeave(button);
    expect(button).toHaveStyle({ transform: 'none' });
  });

  it('stays still on hover while disabled', () => {
    render(<DownloadButton onDownload={vi.fn()} disabled />);
    const button = screen.getByRole('button');

    fireEvent.mouseEnter(button);

    expect(button).not.toHaveStyle({ transform: 'translateY(-1px)' });
  });
});
