import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useVideoInfo } from '@/hooks/useVideoInfo';

const mockInvoke = vi.mocked(invoke);
const mockListen = vi.mocked(listen);

describe('download flow integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListen.mockResolvedValue(() => {});
  });

  it('fetches video info and updates state', async () => {
    const mockInfo = {
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      duration: 212,
      uploader: 'Rick Astley',
      webpage_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      extractor: 'youtube',
      formats: [],
    };
    mockInvoke.mockResolvedValueOnce(mockInfo);

    const { result } = renderHook(() => useVideoInfo());
    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.fetchInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    expect(result.current.status).toBe('success');
    expect(result.current.info?.title).toBe('Rick Astley - Never Gonna Give You Up');
    expect(mockInvoke).toHaveBeenCalledWith('fetch_video_info', {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      cookiesBrowser: null,
    });
  });

  it('handles fetch error', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('yt-dlp error: Video unavailable'));

    const { result } = renderHook(() => useVideoInfo());
    await act(async () => {
      await result.current.fetchInfo('https://www.youtube.com/watch?v=invalid');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('yt-dlp error');
  });

  it('resets state correctly', async () => {
    mockInvoke.mockResolvedValueOnce({
      id: 'test',
      title: 'Test',
      thumbnail: '',
      duration: 60,
      uploader: 'Test',
      webpage_url: '',
      extractor: 'youtube',
      formats: [],
    });

    const { result } = renderHook(() => useVideoInfo());
    await act(async () => {
      await result.current.fetchInfo('https://youtu.be/test');
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.info).toBeNull();
  });
});
