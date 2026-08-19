import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { VideoPreview } from '@/components/VideoPreview';
import type { VideoInfo } from '@/types';

const mockInvoke = vi.mocked(invoke);

const info = {
  id: 'abc',
  title: 'Never Gonna Give You Up',
  thumbnail: 'https://img/thumb.jpg',
  duration: 212,
  uploader: 'Rick Astley',
  webpage_url: 'https://www.youtube.com/watch?v=abc',
  extractor: 'youtube',
  formats: [],
} as unknown as VideoInfo;

const YT = 'https://www.youtube.com/watch?v=abc';

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue('data:image/png;base64,PROXIED');
});

describe('VideoPreview', () => {
  it('shows the title, uploader and duration', async () => {
    render(<VideoPreview info={info} url={YT} />);

    expect(screen.getByRole('heading', { name: info.title })).toBeInTheDocument();
    expect(screen.getByText('Rick Astley · 3:32')).toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });

  it('labels the platform detected from the URL', async () => {
    render(<VideoPreview info={info} url={YT} />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Single video')).toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });

  it('swaps the thumbnail for the Rust-proxied copy', async () => {
    render(<VideoPreview info={info} url={YT} />);

    expect(screen.getByAltText(info.title)).toHaveAttribute('src', 'https://img/thumb.jpg');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_thumbnail', { url: 'https://img/thumb.jpg' });
    await waitFor(() =>
      expect(screen.getByAltText(info.title)).toHaveAttribute(
        'src',
        'data:image/png;base64,PROXIED',
      ),
    );
  });

  it('keeps the original URL when the proxy fails', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));
    render(<VideoPreview info={info} url={YT} />);

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(screen.getByAltText(info.title)).toHaveAttribute('src', 'https://img/thumb.jpg');
  });

  it('falls back to the striped placeholder when the image fails to load', async () => {
    render(<VideoPreview info={info} url={YT} />);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());

    fireEvent.error(screen.getByAltText(info.title));

    expect(screen.queryByAltText(info.title)).not.toBeInTheDocument();
  });

  it('renders the placeholder and skips the proxy when there is no thumbnail', () => {
    render(<VideoPreview info={{ ...info, thumbnail: '' }} url={YT} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('hides the duration badge for a zero-length video', async () => {
    render(<VideoPreview info={{ ...info, duration: 0 }} url={YT} />);

    expect(screen.queryByText('3:32')).not.toBeInTheDocument();
    expect(screen.getByText('Rick Astley')).toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });

  it('shows the duration alone when the uploader is unknown', async () => {
    render(<VideoPreview info={{ ...info, uploader: '' }} url={YT} />);

    expect(screen.getByText('3:32', { selector: 'div' })).toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });

  it('falls back to the unknown-platform styling for an unrecognised URL', async () => {
    render(<VideoPreview info={info} url="https://example.com/video" />);

    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });
});
