import { render, screen, fireEvent } from '@testing-library/react';
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
});

describe('VideoPreview', () => {
  it('shows the title, uploader and duration', () => {
    render(<VideoPreview info={info} url={YT} />);

    expect(screen.getByRole('heading', { name: info.title })).toBeInTheDocument();
    expect(screen.getByText('Rick Astley · 3:32')).toBeInTheDocument();
  });

  it('labels the platform detected from the URL', () => {
    render(<VideoPreview info={info} url={YT} />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('Single video')).toBeInTheDocument();
  });

  it('shows the thumbnail through the app scheme, not from the remote host', () => {
    render(<VideoPreview info={info} url={YT} />);

    expect(screen.getByAltText(info.title)).toHaveAttribute(
      'src',
      'thumb://localhost/https%3A%2F%2Fimg%2Fthumb.jpg',
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('falls back to the striped placeholder when the image fails to load', () => {
    render(<VideoPreview info={info} url={YT} />);

    fireEvent.error(screen.getByAltText(info.title));

    expect(screen.queryByAltText(info.title)).not.toBeInTheDocument();
  });

  it('shows the placeholder again, not a stale image, when the video changes', () => {
    const { rerender } = render(<VideoPreview info={info} url={YT} />);
    fireEvent.error(screen.getByAltText(info.title));

    rerender(
      <VideoPreview
        info={{ ...info, title: 'Other', thumbnail: 'https://img/other.jpg' }}
        url={YT}
      />,
    );

    expect(screen.getByAltText('Other')).toHaveAttribute(
      'src',
      'thumb://localhost/https%3A%2F%2Fimg%2Fother.jpg',
    );
  });

  it('renders the placeholder when there is no thumbnail', () => {
    render(<VideoPreview info={{ ...info, thumbnail: '' }} url={YT} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('hides the duration badge for a zero-length video', () => {
    render(<VideoPreview info={{ ...info, duration: 0 }} url={YT} />);

    expect(screen.queryByText('3:32')).not.toBeInTheDocument();
    expect(screen.getByText('Rick Astley')).toBeInTheDocument();
  });

  it('shows the duration alone when the uploader is unknown', () => {
    render(<VideoPreview info={{ ...info, uploader: '' }} url={YT} />);

    expect(screen.getByText('3:32', { selector: 'div' })).toBeInTheDocument();
  });

  it('falls back to the unknown-platform styling for an unrecognised URL', () => {
    render(<VideoPreview info={info} url="https://example.com/video" />);

    expect(screen.queryByText('YouTube')).not.toBeInTheDocument();
  });
});
