import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import type { PlaylistInfo } from '@/types';

const mockPlaylist: PlaylistInfo = {
  kind: 'playlist',
  title: 'My Channel Videos',
  uploader: 'TestUser',
  playlist_count: 47,
  entries: [],
};

describe('PlaylistPreview', () => {
  it('renders playlist title', () => {
    render(<PlaylistPreview info={mockPlaylist} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.getByText('My Channel Videos')).toBeInTheDocument();
  });

  it('renders uploader name', () => {
    render(<PlaylistPreview info={mockPlaylist} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.getByText(/TestUser/)).toBeInTheDocument();
  });

  it('renders video count', () => {
    render(<PlaylistPreview info={mockPlaylist} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.getByText(/47 videos/i)).toBeInTheDocument();
  });

  it('renders platform badge', () => {
    render(<PlaylistPreview info={mockPlaylist} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.getByText('YouTube')).toBeInTheDocument();
  });

  it('renders Playlist label', () => {
    render(<PlaylistPreview info={mockPlaylist} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.getByText('Playlist')).toBeInTheDocument();
  });

  it('handles missing playlist_count gracefully', () => {
    const noCount = { ...mockPlaylist, playlist_count: null };
    render(<PlaylistPreview info={noCount} url="https://www.youtube.com/@testuser" selectedUrls={[]} onSelectionChange={() => {}} />);
    expect(screen.queryByText(/\d+ videos/i)).not.toBeInTheDocument();
  });
});
