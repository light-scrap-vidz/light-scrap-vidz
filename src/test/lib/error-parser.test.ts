import { describe, it, expect } from 'vitest';
import { parseYtdlpError } from '@/lib/error-parser';
import { getT } from '@/lib/i18n';

describe('parseYtdlpError — recognised patterns', () => {
  const cases: Array<[string, string, string]> = [
    ['login required', 'ERROR: Login required to watch this video', 'err.loginRequired'],
    ['instagram csrf', 'ERROR: no csrf token in response', 'err.instagramLogin'],
    ['facebook parse', 'ERROR: Cannot parse data from Facebook', 'err.facebookLogin'],
    ['cookies', 'ERROR: cookies are required for this site', 'err.cookiesRequired'],
    ['impersonation', 'ERROR: Attempting impersonation but no impersonate target is available', 'err.curlCffi'],
    ['impersonate target', 'ERROR: none of these impersonate targets are available', 'err.curlCffi'],
    ['ip blocked', 'ERROR: Your IP is blocked from accessing this content', 'err.ipBlocked'],
    ['geo block', 'ERROR: This video is geo-blocked', 'err.geoBlocked'],
    ['no video', 'ERROR: No video could be found in this post', 'err.noVideo'],
    ['clip gone', 'ERROR: This clip is no longer available', 'err.clipGone'],
    ['private', 'ERROR: This video is private', 'err.private'],
    ['age gate', 'ERROR: This video is age-restricted', 'err.ageRestricted'],
    ['unavailable', 'ERROR: This video is unavailable', 'err.unavailable'],
    ['copyright', 'ERROR: removed for copyright infringement', 'err.copyright'],
    ['account gone', 'ERROR: This account has been terminated', 'err.accountGone'],
    ['no formats', 'ERROR: No formats available for this video', 'err.cannotExtract'],
    ['rate limit', 'ERROR: HTTP Error 429: Too Many Requests', 'err.rateLimited'],
    ['broken extractor', 'ERROR: This extractor is marked as broken', 'err.brokenExtractor'],
  ];

  it.each(cases)('maps %s to its message key', (_label, raw, expected) => {
    expect(parseYtdlpError(raw)).toBe(expected);
  });

  it.each(cases)('has %s written in both languages', (_label, raw, key) => {
    // Une clé absente du dictionnaire ressortirait telle quelle : c'est exactement ce
    // qu'il ne faut pas montrer à l'utilisateur.
    for (const lang of ['en', 'fr'] as const) {
      expect(getT(lang)(key)).not.toBe(raw);
      expect(getT(lang)(key)).not.toBe(key);
    }
  });

  it('matches case-insensitively', () => {
    expect(parseYtdlpError('THIS VIDEO IS PRIVATE')).toBe('err.private');
  });

  it('returns the first matching pattern when several could apply', () => {
    // "login required" sits above "private video" in the pattern list.
    expect(parseYtdlpError('login required, and this video is private')).toBe('err.loginRequired');
  });

  it("classifies YouTube's age-gate wording as a login problem", () => {
    // The auth section's /sign in to/ pattern precedes the age-gate one, so YouTube's
    // canonical "Sign in to confirm your age" lands on the login message. Both messages
    // point at the Auth selector, so the advice stays correct even though the wording is
    // about login rather than age.
    expect(parseYtdlpError('ERROR: Sign in to confirm your age')).toBe('err.loginRequired');
  });

  it('leaves an unrecognised message alone, so it survives translation untouched', () => {
    const raw = 'ERROR: brand new breakage';
    const parsed = parseYtdlpError(raw);

    expect(getT('fr')(parsed)).toBe(parsed);
  });
});

describe('parseYtdlpError — fallback on the last ERROR line', () => {
  it('picks the last ERROR line when no pattern matches', () => {
    const raw = [
      '[debug] Command-line config',
      'WARNING: something noisy',
      'ERROR: [TikTok] 12345: totally novel failure',
    ].join('\n');
    expect(parseYtdlpError(raw)).toBe('totally novel failure');
  });

  it('strips the extractor prefix but keeps the message', () => {
    expect(parseYtdlpError('ERROR: [Youtube] abc: brand new breakage')).toBe(
      'brand new breakage',
    );
  });

  it('ignores ERROR lines coming from debug output', () => {
    const raw = ['[debug] ERROR: ignore me', 'ERROR: keep me please'].join('\n');
    // The prefix stripper only fires on an "[Extractor] id:" segment, so a bare
    // "ERROR: …" line reaches the user with its prefix intact.
    expect(parseYtdlpError(raw)).toBe('ERROR: keep me please');
  });

  it('keeps the whole line when stripping would empty it', () => {
    expect(parseYtdlpError('ERROR: [TikTok] 12345: ')).toBe('ERROR: [TikTok] 12345:');
  });

  it('uses the last ERROR line when there are several', () => {
    const raw = ['ERROR: first oddity', 'ERROR: second oddity'].join('\n');
    expect(parseYtdlpError(raw)).toBe('ERROR: second oddity');
  });
});

describe('parseYtdlpError — fallback with no ERROR line at all', () => {
  it('falls back to the last meaningful line', () => {
    const raw = ['[debug] noise', 'WARNING: also noise', 'something odd happened'].join('\n');
    expect(parseYtdlpError(raw)).toBe('something odd happened');
  });

  it('falls back to the trimmed raw text when everything is filtered out', () => {
    expect(parseYtdlpError('  [debug] only debug  ')).toBe('[debug] only debug');
  });

  it('handles an empty string', () => {
    expect(parseYtdlpError('')).toBe('');
  });
});
