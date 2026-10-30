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
  downloaded: '8.6MiB',
  indeterminate: false,
  stage: null,
};

describe('ProgressCard', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<ProgressCard status="idle" progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is cancelled', () => {
    const { container } = render(<ProgressCard status="cancelled" progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is complete', () => {
    const { container } = render(<ProgressCard status="complete" progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is error', () => {
    const { container } = render(<ProgressCard status="error" progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows rounded percent during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} />);
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('shows speed during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} />);
    expect(screen.getByText('1.23MiB/s')).toBeInTheDocument();
  });

  it('shows ETA during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} />);
    expect(screen.getByText('ETA 00:09')).toBeInTheDocument();
  });

  it('shows filename during download', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} />);
    expect(screen.getByText('my_video.mp4')).toBeInTheDocument();
  });

  it('exposes the progress to assistive technology', () => {
    render(<ProgressCard status="downloading" progress={mockProgress} />);

    const bar = screen.getByRole('progressbar', { name: 'Download progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '47');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('reaches 100% and fills the bar', () => {
    const { container } = render(
      <ProgressCard status="downloading" progress={{ ...mockProgress, percent: 100 }} />,
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(container.querySelector('div[style*="width: 100%"]')).toBeTruthy();
  });

  it('clamps a value outside 0-100', () => {
    render(<ProgressCard status="downloading" progress={{ ...mockProgress, percent: 130 }} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('shows the amount downloaded, not a percentage, when the size is unknown', () => {
    const { container } = render(
      <ProgressCard
        status="downloading"
        progress={{
          ...mockProgress,
          percent: 0,
          indeterminate: true,
          downloaded: '12.00MiB',
          eta: '',
        }}
      />,
    );

    expect(screen.getByText('12.00MiB downloaded')).toBeInTheDocument();
    expect(screen.queryByText('%')).toBeNull();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
    expect(container.querySelector('.lsv-indeterminate')).toBeTruthy();
  });

  it.each([
    ['merging', 'Merging video and audio…'],
    ['converting', 'Converting…'],
    ['fixing', 'Fixing the file…'],
    ['processing', 'Finishing…'],
  ])('names the %s step instead of showing a stuck bar', (stage, label) => {
    const { container } = render(
      <ProgressCard status="downloading" progress={{ ...mockProgress, percent: 100, stage }} />,
    );

    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.queryByText('%')).toBeNull();
    expect(container.querySelector('.lsv-indeterminate')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', label);
  });

  it('ignores a step it does not know', () => {
    render(
      <ProgressCard status="downloading" progress={{ ...mockProgress, stage: 'teleporting' }} />,
    );

    expect(screen.getByText('47')).toBeInTheDocument();
  });

  it('announces the step, not every tick, to screen readers', () => {
    const { rerender } = render(
      <ProgressCard status="downloading" progress={{ ...mockProgress, stage: 'merging' }} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Merging video and audio…');

    rerender(<ProgressCard status="downloading" progress={{ ...mockProgress, percent: 80 }} />);

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('shows which item of a playlist is running', () => {
    render(
      <ProgressCard
        status="downloading"
        progress={{ ...mockProgress, current_item: 2, total_items: 5 }}
      />,
    );

    expect(screen.getAllByText('Item 2 of 5').length).toBeGreaterThan(0);
  });

  it('hides unknown speed and eta', () => {
    render(
      <ProgressCard
        status="downloading"
        progress={{ ...mockProgress, speed: 'Unknown B/s', eta: 'Unknown' }}
      />,
    );

    expect(screen.queryByText('Unknown B/s')).toBeNull();
    expect(screen.queryByText(/ETA/)).toBeNull();
  });
});
