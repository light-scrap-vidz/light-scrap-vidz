import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    render(<HistoryList entries={[]} />);
    expect(screen.getByText('No downloads yet')).toBeInTheDocument();
  });
});

describe('HistoryList — relative times', () => {
  it.each([
    [0, 'now'],
    [30_000, 'now'],
    [5 * 60_000, '5 minutes ago'],
    [59 * 60_000, '59 minutes ago'],
    [2 * 3_600_000, '2 hours ago'],
    [23 * 3_600_000, '23 hours ago'],
    [3 * 86_400_000, '3 days ago'],
  ])('renders an age of %ims as "%s"', (age, expected) => {
    render(<HistoryList entries={[entry({ downloaded_at: NOW - age })]} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe('HistoryList — selecting an entry', () => {
  it('reports the URL, then marks the row once the fetch starts', () => {
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <HistoryList entries={[entry()]} onSelect={onSelect} isLoading={false} />,
    );

    fireEvent.click(screen.getByText('A clip'));
    expect(onSelect).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc');

    // The row only turns into a spinner once the parent reports the fetch is running.
    rerender(<HistoryList entries={[entry()]} onSelect={onSelect} isLoading />);

    expect(container.querySelector('.lsv-spin')).toBeTruthy();
    expect(screen.getByText('Fetching info…')).toBeInTheDocument();
  });

  it('dims the rows that were not chosen while a fetch runs', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <HistoryList
        entries={[entry(), entry({ id: '2', title: 'Another clip' })]}

        onSelect={onSelect}
        isLoading={false}
      />,
    );
    fireEvent.click(screen.getByText('A clip'));

    rerender(
      <HistoryList
        entries={[entry(), entry({ id: '2', title: 'Another clip' })]}

        onSelect={onSelect}
        isLoading
      />,
    );

    expect(screen.getByText('Another clip').closest('[aria-disabled]')).toHaveClass('opacity-50');
  });

  it('does nothing when no select handler is given', () => {
    const { container } = render(<HistoryList entries={[entry()]} />);

    fireEvent.click(screen.getByText('A clip'));

    expect(container.querySelector('.lsv-spin')).toBeNull();
  });

  it('ignores clicks while a fetch is already running', () => {
    const onSelect = vi.fn();
    render(<HistoryList entries={[entry()]} onSelect={onSelect} isLoading />);

    fireEvent.click(screen.getByText('A clip'));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clears the pending row once loading finishes', () => {
    const onSelect = vi.fn();
    const { rerender, container } = render(
      <HistoryList entries={[entry()]} onSelect={onSelect} isLoading={false} />,
    );
    fireEvent.click(screen.getByText('A clip'));
    rerender(<HistoryList entries={[entry()]} onSelect={onSelect} isLoading />);
    expect(container.querySelector('.lsv-spin')).toBeTruthy();

    rerender(<HistoryList entries={[entry()]} onSelect={onSelect} isLoading={false} />);

    expect(container.querySelector('.lsv-spin')).toBeNull();
    expect(screen.getByText('A clip')).toBeInTheDocument();
  });
});

describe('HistoryList — thumbnails', () => {
  it('serves the stored thumbnail through the thumb:// scheme, never from the remote host', () => {
    const { container } = render(<HistoryList entries={[entry()]} />);

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'thumb://localhost/https%3A%2F%2Fimg%2Fthumb.jpg');
    expect(container.innerHTML).not.toContain('src="https://img');
  });

  it('asks the backend for no thumbnail over IPC any more', () => {
    render(<HistoryList entries={[entry()]} />);

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('falls back to the placeholder when the image fails to load', () => {
    const { container } = render(<HistoryList entries={[entry()]} />);

    fireEvent.error(container.querySelector('img')!);

    expect(container.querySelector('img')).toBeNull();
  });

  it('renders the placeholder directly when there is no thumbnail', () => {
    const { container } = render(<HistoryList entries={[entry({ thumbnail: '' })]} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('HistoryList — revealing the file', () => {
  it('opens the containing folder without selecting the row', () => {
    const onSelect = vi.fn();
    render(<HistoryList entries={[entry()]} onSelect={onSelect} />);

    fireEvent.click(screen.getByLabelText('Reveal in folder'));

    expect(mockInvoke).toHaveBeenCalledWith('open_folder', { path: '/out/clip.mp4' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('HistoryList — titles', () => {
  it('names an untitled entry after its file', () => {
    render(<HistoryList entries={[entry({ title: '', filepath: '/out/Episode 3.mp4' })]} />);

    expect(screen.getByText('Episode 3.mp4')).toBeInTheDocument();
  });

  it('falls back to a translated word when nothing names the entry', () => {
    render(<HistoryList entries={[entry({ title: '', filepath: '' })]} />);

    expect(screen.getByText('Playlist')).toBeInTheDocument();
  });
});

describe('HistoryList — a file that is gone', () => {
  it('says so, and offers to drop the entry', async () => {
    mockInvoke.mockRejectedValue('File not found: /out/clip.mp4');
    const onRemove = vi.fn();
    render(<HistoryList entries={[entry()]} onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText('Reveal in folder'));

    expect(await screen.findByRole('alert')).toHaveTextContent('File not found');
    fireEvent.click(screen.getByRole('button', { name: 'Remove from history' }));
    expect(onRemove).toHaveBeenCalledWith('1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows no message when the folder opens', async () => {
    render(<HistoryList entries={[entry()]} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByLabelText('Reveal in folder'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('HistoryList — structure and freshness', () => {
  it('never nests one interactive control inside another', () => {
    const { container } = render(<HistoryList entries={[entry()]} onSelect={vi.fn()} />);

    expect(container.querySelector('[role="button"]')).toBeNull();
    expect(container.querySelectorAll('button button')).toHaveLength(0);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('refreshes "5 minutes ago" as time passes', () => {
    render(<HistoryList entries={[entry({ downloaded_at: NOW - 5 * 60_000 })]} />);
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('6 minutes ago')).toBeInTheDocument();
  });
});

describe('HistoryList — several entries', () => {
  it('renders one row per entry', () => {
    render(
      <HistoryList entries={[entry(), entry({ id: '2', title: 'Another clip', thumbnail: '' })]} />,
    );

    expect(screen.getByText('A clip')).toBeInTheDocument();
    expect(screen.getByText('Another clip')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Reveal in folder')).toHaveLength(2);
  });
});
