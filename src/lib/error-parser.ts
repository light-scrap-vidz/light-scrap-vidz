const PATTERNS: Array<{ re: RegExp; msg: string }> = [
  // --- Auth / login ---
  {
    re: /login.*required|not logged in|sign in to|login to watch|requires.*authentication/i,
    msg: 'err.loginRequired',
  },
  {
    re: /no csrf token|empty media response|check if this post is accessible/i,
    msg: 'err.instagramLogin',
  },
  {
    re: /cannot parse data.*facebook|facebook.*cannot parse/i,
    msg: 'err.facebookLogin',
  },
  {
    re: /cookies.*required|use --cookies|pass cookies/i,
    msg: 'err.cookiesRequired',
  },

  // --- Impersonation / curl-cffi ---
  {
    re: /attempting impersonation.*no impersonate target|no impersonate target.*available/i,
    msg: 'err.curlCffi',
  },
  {
    re: /impersonate.*firefox|impersonate.*chrome|none of these impersonate targets/i,
    msg: 'err.curlCffi',
  },

  // --- IP / access blocks ---
  {
    re: /your ip.*blocked|ip.*blocked.*accessing|ip address.*blocked/i,
    msg: 'err.ipBlocked',
  },
  {
    re: /geo.?block|not available.*country|not available.*region|geo.?restrict/i,
    msg: 'err.geoBlocked',
  },

  // --- Content issues ---
  {
    re: /no video could be found|no video.*in this tweet|no video.*post/i,
    msg: 'err.noVideo',
  },
  {
    re: /clip is no longer available|clip.*not available|no longer available/i,
    msg: 'err.clipGone',
  },
  {
    re: /private.*video|video.*private|this video is private/i,
    msg: 'err.private',
  },
  {
    re: /age.?restrict|age.?gate|confirm your age/i,
    msg: 'err.ageRestricted',
  },
  {
    re: /video.*unavailable|this video is unavailable|has been removed/i,
    msg: 'err.unavailable',
  },
  {
    re: /copyright|matched third.party/i,
    msg: 'err.copyright',
  },
  {
    re: /account.*terminated|channel.*removed|user.*not found/i,
    msg: 'err.accountGone',
  },

  // --- Extractors / yt-dlp ---
  {
    re: /no formats?.*available|unable to extract/i,
    msg: 'err.cannotExtract',
  },
  {
    re: /429|rate.?limit|too many requests/i,
    msg: 'err.rateLimited',
  },
  {
    re: /marked as broken|extractor.*broken/i,
    msg: 'err.brokenExtractor',
  },
];

/** Renvoie une clé de traduction quand l'erreur est reconnue, sinon la ligne brute de
 * yt-dlp. Les deux traversent `t()` sans dommage : une clé inconnue est rendue telle
 * quelle, donc l'appelant n'a pas à faire la différence. */
export function parseYtdlpError(raw: string): string {
  for (const { re, msg } of PATTERNS) {
    if (re.test(raw)) return msg;
  }
  // Return last meaningful ERROR line, stripping WARNING/debug noise
  const errorLine = raw
    .split('\n')
    .filter((l) => l.trim() && l.includes('ERROR:') && !l.startsWith('[debug]'))
    .at(-1);
  if (errorLine) {
    // Strip yt-dlp prefix like "ERROR: [TikTok] id: "
    return errorLine.replace(/^ERROR:\s*(\[\w+\]\s*)?[\w-]+:\s*/i, '').trim() || errorLine.trim();
  }
  const meaningful = raw
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('[debug]') && !l.startsWith('WARNING'))
    .at(-1);
  return meaningful?.trim() || raw.trim();
}
