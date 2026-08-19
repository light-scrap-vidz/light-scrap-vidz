import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HistoryList } from '@/components/HistoryList';
import type { HistoryEntry } from '@/types';

const mockEntry: HistoryEntry = {
  id: 'entry-1',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Rick Astley - Never Gonna Give You Up',
  thumbnail: '',
  platform: 'youtube',
  filepath: '/home/user/Downloads/Rick Astley.mp4',
  downloaded_at: Date.now() - 60000,
  quality: 'best',
};

describe('HistoryList', () => {
  it('shows empty state when no entries', () => {
    render(<HistoryList entries={[]} onClear={vi.fn()} />);
    expect(screen.getByText(/no downloads yet/i)).toBeInTheDocument();
  });

  it('renders history entry title', () => {
    render(<HistoryList entries={[mockEntry]} onClear={vi.fn()} />);
    expect(screen.getByText('Rick Astley - Never Gonna Give You Up')).toBeInTheDocument();
  });

  it('renders platform badge', () => {
    render(<HistoryList entries={[mockEntry]} onClear={vi.fn()} />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });

  it('renders reveal-in-folder button', () => {
    render(<HistoryList entries={[mockEntry]} onClear={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reveal in folder/i })).toBeInTheDocument();
  });
});
