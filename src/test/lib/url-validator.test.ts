import { describe, it, expect } from 'vitest';
import { getPlatform, isPlaylistUrl, getUrlKind, isValidUrl, normalizeUrl } from '@/lib/url-validator';

describe('getPlatform', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.tiktok.com/@user/video/123', 'tiktok'],
    ['https://www.instagram.com/p/abc/', 'instagram'],
    ['https://www.facebook.com/watch/?v=123', 'facebook'],
    ['https://m.youtube.com/watch?v=abc', 'youtube'],
    ['https://www.youtube.com/live/abc', 'youtube'],
    ['https://www.facebook.com/reel/123', 'facebook'],
    ['https://player.vimeo.com/video/123', 'vimeo'],
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

  it('accepts a channel link carrying a share parameter', () => {
    expect(isPlaylistUrl('https://www.youtube.com/@chaine?si=abc')).toBe(true);
    expect(isPlaylistUrl('https://www.tiktok.com/@user?_t=1')).toBe(true);
  });

  it('does not treat an Instagram profile as a playlist', () => {
    expect(isPlaylistUrl('https://www.instagram.com/someone/')).toBe(false);
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

describe('normalizeUrl', () => {
  it.each([
    ['https://www.youtube.com/@YouTube', 'https://www.youtube.com/@YouTube/videos'],
    ['https://www.youtube.com/@YouTube/', 'https://www.youtube.com/@YouTube/videos'],
    ['https://www.youtube.com/@YouTube?si=abc', 'https://www.youtube.com/@YouTube/videos'],
    ['https://www.youtube.com/channel/UC123', 'https://www.youtube.com/channel/UC123/videos'],
  ])('sends the channel root %s to its Videos tab', (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });

  it.each([
    'https://www.youtube.com/@YouTube/shorts',
    'https://www.youtube.com/playlist?list=PL1',
    'https://www.youtube.com/watch?v=abc',
    'https://www.tiktok.com/@user',
    'not a url',
  ])('leaves %s untouched', (input) => {
    expect(normalizeUrl(input)).toBe(input);
  });
});
