import { describe, it, expect, beforeEach } from 'vitest';
import { loadCookiesChoice, resolveCookies, saveCookiesChoice, BROWSERS } from '@/lib/cookies';

beforeEach(() => localStorage.clear());

describe('resolveCookies', () => {
  const detected = ['firefox', 'chrome'];

  it('never reads cookies after the user picked None, wherever the link points', () => {
    for (const url of [
      'https://www.instagram.com/p/a/',
      'https://www.facebook.com/watch?v=1',
      'https://www.youtube.com/watch?v=a',
    ]) {
      expect(resolveCookies('none', url, detected)).toBeNull();
    }
  });

  it('uses the browser the user picked, on any site', () => {
    expect(resolveCookies('chrome', 'https://www.youtube.com/watch?v=a', detected)).toBe('chrome');
    expect(resolveCookies('brave', 'https://www.instagram.com/p/a/', [])).toBe('brave');
  });

  it('picks the first detected browser for sites that need a login, on Auto', () => {
    expect(resolveCookies('auto', 'https://www.instagram.com/p/a/', detected)).toBe('firefox');
    expect(resolveCookies('auto', 'https://www.facebook.com/watch?v=1', detected)).toBe('firefox');
  });

  it('reads nothing on Auto for sites that work without a login', () => {
    expect(resolveCookies('auto', 'https://www.youtube.com/watch?v=a', detected)).toBeNull();
    expect(resolveCookies('auto', 'https://www.tiktok.com/@u/video/1', detected)).toBeNull();
    expect(resolveCookies('auto', 'https://vimeo.com/123', detected)).toBeNull();
  });

  it('reads nothing on Auto when no browser was detected', () => {
    expect(resolveCookies('auto', 'https://www.instagram.com/p/a/', [])).toBeNull();
  });

  it('prefers a regular browser to Safari, which needs Full Disk Access', () => {
    expect(resolveCookies('auto', 'https://www.instagram.com/p/a/', ['safari', 'firefox'])).toBe(
      'firefox',
    );
  });

  it('ignores a detected name that is not a browser yt-dlp can read', () => {
    expect(resolveCookies('auto', 'https://www.instagram.com/p/a/', ['netscape'])).toBeNull();
  });
});

describe('the saved choice', () => {
  it('starts on Auto', () => {
    expect(loadCookiesChoice()).toBe('auto');
  });

  it('remembers None and a browser', () => {
    saveCookiesChoice('none');
    expect(loadCookiesChoice()).toBe('none');
    saveCookiesChoice('vivaldi');
    expect(loadCookiesChoice()).toBe('vivaldi');
  });

  it('falls back to Auto for anything else', () => {
    localStorage.setItem('light-scrap-vidz:cookies', 'firefox:/home/me/.mozilla/x');
    expect(loadCookiesChoice()).toBe('auto');
  });

  it('lists the browsers yt-dlp reads', () => {
    expect(BROWSERS).toContain('brave');
    expect(BROWSERS).toContain('safari');
  });
});
