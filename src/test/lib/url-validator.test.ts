import { describe, it, expect } from 'vitest';
import { getPlatform, isPlaylistUrl, getUrlKind, isValidUrl } from '@/lib/url-validator';

describe('getPlatform', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.tiktok.com/@user/video/123', 'tiktok'],
    ['https://www.instagram.com/p/abc/', 'instagram'],
    ['https://www.facebook.com/watch/?v=123', 'facebook'],
  ])('recognises %s', (url, expected) => {
    expect(getPlatform(url)).toBe(expected);
  });

  it('falls back to unknown for an unrelated host', () => {
    expect(getPlatform('https://example.com/video')).toBe('unknown');
  });

  it('recognises the platform of a playlist URL too', () => {
    expect(getPlatform('https://www.youtube.com/playlist?list=PL123')).toBe('youtube');
  });
});

describe('isPlaylistUrl', () => {
  it('accepts a YouTube playlist', () => {
    expect(isPlaylistUrl('https://www.youtube.com/playlist?list=PL123')).toBe(true);
  });

  it('rejects a single video', () => {
    expect(isPlaylistUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
  });

  it('rejects anything that is not a URL at all', () => {
    expect(isPlaylistUrl('not a url')).toBe(false);
    expect(isPlaylistUrl('')).toBe(false);
  });
});

describe('getUrlKind', () => {
  it('reports playlist for a playlist URL', () => {
    expect(getUrlKind('https://www.youtube.com/playlist?list=PL123')).toBe('playlist');
  });

  it('reports single for a video URL', () => {
    expect(getUrlKind('https://youtu.be/abc')).toBe('single');
  });

  it('reports single for malformed input', () => {
    expect(getUrlKind('nonsense')).toBe('single');
  });
});

describe('isValidUrl', () => {
  it('accepts a supported platform URL', () => {
    expect(isValidUrl('https://youtu.be/abc')).toBe(true);
  });

  it('rejects a well-formed URL on an unsupported host', () => {
    expect(isValidUrl('https://example.com/video')).toBe(false);
  });

  it('rejects a malformed URL', () => {
    expect(isValidUrl('http//broken')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});
