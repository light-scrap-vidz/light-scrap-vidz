const PATTERNS: Array<{ re: RegExp; msg: string }> = [
  // --- Raised by the app itself (English messages from the Rust backend) ---
  { re: /yt-dlp not found/i, msg: 'err.ytdlpMissing' },
  { re: /failed to (spawn|run) yt-dlp/i, msg: 'err.spawn' },
  { re: /checksum mismatch|no checksum published/i, msg: 'err.checksum' },
  { re: /yt-dlp exited with an error/i, msg: 'err.generic' },
  { re: /failed to parse (video|playlist) info/i, msg: 'err.parse' },
  { re: /update is already running/i, msg: 'err.updateRunning' },
  { re: /already (running|being downloaded)/i, msg: 'err.alreadyRunning' },
  { re: /invalid output folder/i, msg: 'err.badOutputDir' },
  { re: /unsupported browser/i, msg: 'err.badBrowser' },
  { re: /^unsupported url$|unsupported url:/i, msg: 'err.unsupportedUrl' },
  { re: /file not found/i, msg: 'err.fileNotFound' },
  {
    re: /cannot install yt-dlp|cannot (create|write|read|set)|cannot (reach|determine)|no checksum published|download failed:|cannot build http client/i,
    msg: 'err.updateFailed',
  },

  // --- Missing tools on this machine ---
  {
    re: /ffmpeg is not installed|ffprobe and ffmpeg not found|ffmpeg not found|ffprobe not found|ffmpeg.*not (installed|found)/i,
    msg: 'err.ffmpegMissing',
  },
  {
    re: /operation not permitted.*(cookies|safari)|safari.*operation not permitted/i,
    msg: 'err.safariAccess',
  },

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
    re: /unsupported url/i,
    msg: 'err.unsupportedUrl',
  },
  {
    re: /no formats?.*available|unable to extract/i,
    msg: 'err.cannotExtract',
  },
  {
    re: /\bHTTP Error 429\b|rate.?limit|too many requests/i,
    msg: 'err.rateLimited',
  },
  {
    re: /marked as broken|extractor.*broken/i,
    msg: 'err.brokenExtractor',
  },
];

/** Une ligne d'erreur de yt-dlp, éventuellement préfixée par le message du backend. */
const ERROR_LINE = /^\s*(?:yt-dlp error:\s*)?ERROR:/;

function matchKey(text: string): string | null {
  for (const { re, msg } of PATTERNS) {
    if (re.test(text)) return msg;
  }
  return null;
}

/** Renvoie une clé de traduction quand l'erreur est reconnue, sinon la ligne brute de
 * yt-dlp. Les deux traversent `t()` sans dommage : une clé inconnue est rendue telle
 * quelle, donc l'appelant n'a pas à faire la différence.
 *
 * La vraie cause est dans les lignes `ERROR:` (la dernière d'abord) : un `WARNING: HTTP
 * Error 429 … Retrying` qui les précède n'est qu'un incident surmonté, et ne doit pas
 * l'emporter. Le reste du texte ne sert qu'à défaut. */
export function parseYtdlpError(raw: string): string {
  const lines = raw.split('\n');
  const errorLines = lines.filter((l) => ERROR_LINE.test(l)).reverse();
  for (const line of errorLines) {
    const key = matchKey(line);
    if (key) return key;
  }
  const others = lines.filter((l) => !ERROR_LINE.test(l) && !/^\s*WARNING:/.test(l));
  const key = matchKey(others.join('\n')) ?? (errorLines.length ? null : matchKey(raw));
  if (key) return key;

  // Return last meaningful ERROR line, stripping WARNING/debug noise
  const errorLine = lines
    .filter((l) => l.trim() && l.includes('ERROR:') && !l.startsWith('[debug]'))
    .at(-1);
  if (errorLine) {
    // Strip yt-dlp prefix like "ERROR: [TikTok] id: "
    return (
      errorLine
        .replace(/^(?:yt-dlp error:\s*)?ERROR:\s*(\[\w+\]\s*)?[\w-]+:\s*/i, '')
        .trim() || errorLine.trim()
    );
  }
  const meaningful = lines
    .filter((l) => l.trim() && !l.startsWith('[debug]') && !l.startsWith('WARNING'))
    .at(-1);
  return meaningful?.trim() || raw.trim();
}
