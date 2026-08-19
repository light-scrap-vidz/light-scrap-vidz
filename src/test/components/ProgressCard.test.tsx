import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressCard } from '@/components/ProgressCard';
import type { DownloadProgress } from '@/types';

const mockProgress: DownloadProgress = {
  download_id: 'test-id',
  percent: 47.3,
  speed: '1.23MiB/s',
  eta: '00:09',
  filename: 'my_video.mp4',
  current_item: null,
  total_items: null,
};

describe('ProgressCard', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<ProgressCard status="idle" progress={null} error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is ready', () => {
    const { container } = render(<ProgressCard status="ready" progress={null} error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is complete', () => {
    const { container } = render(<ProgressCard status="complete" progress={null} error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is error', () => {
    const { container } = render(<ProgressCard status="error" progress={null} error="Network error" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows rounded percent during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} error={null} />);
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('shows speed during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} error={null} />);
    expect(screen.getByText('1.23MiB/s')).toBeInTheDocument();
  });

  it('shows ETA during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} error={null} />);
    expect(screen.getByText('ETA 00:09')).toBeInTheDocument();
  });

  it('shows filename during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} error={null} />);
    expect(screen.getByText('my_video.mp4')).toBeInTheDocument();
  });
});
