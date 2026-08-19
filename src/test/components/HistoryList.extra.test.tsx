import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { HistoryList } from '@/components/HistoryList';
import type { HistoryEntry } from '@/types';

const mockInvoke = vi.mocked(invoke);

const NOW = new Date('2026-08-17T12:00:00Z').getTime();

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: '1',
  url: 'https://www.youtube.com/watch?v=abc',
  title: 'A clip',
  thumbnail: 'https://img/thumb.jpg',
  platform: 'youtube',
  filepath: '/out/clip.mp4',
  downloaded_at: NOW,
  quality: 'best',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  mockInvoke.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HistoryList — empty state', () => {
  it('says so when there is nothing to show', () => {
    render(<HistoryList entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
  });
});

describe('HistoryList — relative times', () => {
  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [59 * 60_000, '59m ago'],
    [2 * 3_600_000, '2h ago'],
    [23 * 3_600_000, '23h ago'],
    [3 * 86_400_000, '3d ago'],
  ])('renders an age of %ims as "%s"', (age, expected) => {
    render(<HistoryList entries={[entry({ downloaded_at: NOW - age })]} onClear={vi.fn()} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('HistoryList — selecting an entry', () => {
  it('reports the URL, then marks the row once the fetch starts', () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading={false} />,
    );

    fireEvent.click(screen.getByText('A clip'));
    expect(onSelect).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc');

    // The row only turns into a spinner once the parent reports the fetch is running.
    rerender(
      <HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading />,
    );

    expect(container.querySelector('.lsv-spin')).toBeTruthy();
    expect(screen.getByText('Fetching info…')).toBeInTheDocument();
  });

  it('dims the rows that were not chosen while a fetch runs', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <HistoryList
        entries={[entry(), entry({ id: '2', title: 'Another clip' })]}
        onClear={vi.fn()}
        onSelect={onSelect}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('A clip'));

    rerender(
      <HistoryList
        entries={[entry(), entry({ id: '2', title: 'Another clip' })]}
        onClear={vi.fn()}
        onSelect={onSelect}
        isLoading
      />,
    );

    expect(screen.getByText('Another clip').closest('div[style*="opacity"]')).toHaveStyle({
      opacity: '0.5',
    });
  });

  it('does nothing when no select handler is given', () => {
    const { container } = render(<HistoryList entries={[entry()]} onClear={vi.fn()} />);

    fireEvent.click(screen.getByText('A clip'));

    expect(container.querySelector('.lsv-spin')).toBeNull();
  });

  it('ignores clicks while a fetch is already running', () => {
    const onSelect = vi.fn();
    render(
      <HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading />,
    );

    fireEvent.click(screen.getByText('A clip'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clears the pending row once loading finishes', () => {
    const onSelect = vi.fn();
    const { rerender, container } = render(
      <HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading={false} />,
    );
    fireEvent.click(screen.getByText('A clip'));
    rerender(<HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading />);
    expect(container.querySelector('.lsv-spin')).toBeTruthy();

    rerender(
      <HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} isLoading={false} />,
    );

    expect(container.querySelector('.lsv-spin')).toBeNull();
    expect(screen.getByText('A clip')).toBeInTheDocument();
  });
});

describe('HistoryList — thumbnails', () => {
  it('shows the stored thumbnail', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} />);
    expect(screen.getByAltText('A clip')).toHaveAttribute('src', 'https://img/thumb.jpg');
  });

  it('falls back to a striped placeholder when the image fails', () => {
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} />);
    const img = screen.getByAltText('A clip');

    fireEvent.error(img);

    expect(img).toHaveStyle({ display: 'none' });
    expect(img.parentElement?.style.background).toContain('repeating-linear-gradient');
    expect(img.parentElement?.querySelectorAll('div')).toHaveLength(1);
  });

  it('renders the placeholder directly when there is no thumbnail', () => {
    render(<HistoryList entries={[entry({ thumbnail: '' })]} onClear={vi.fn()} />);
    expect(screen.queryByAltText('A clip')).not.toBeInTheDocument();
  });
});

describe('HistoryList — revealing the file', () => {
  it('opens the containing folder without selecting the row', () => {
    const onSelect = vi.fn();
    render(<HistoryList entries={[entry()]} onClear={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText('Reveal in folder'));

    expect(mockInvoke).toHaveBeenCalledWith('open_folder', { path: '/out/clip.mp4' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('HistoryList — several entries', () => {
  it('renders one row per entry', () => {
    render(
      <HistoryList
        entries={[entry(), entry({ id: '2', title: 'Another clip', thumbnail: '' })]}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText('A clip')).toBeInTheDocument();
    expect(screen.getByText('Another clip')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Reveal in folder')).toHaveLength(2);
  });
});
