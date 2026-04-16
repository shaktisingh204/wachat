/**
 * Media URL parsers for chat bubble renderers.
 *
 * These helpers accept any string (including malformed URLs) and return
 * `null` when the input doesn't match the expected shape. They never throw.
 */

export type MediaProvider =
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'instagram'
  | 'direct'
  | 'unknown';

export type YouTubeInfo = {
  videoId: string;
  /** Start offset in seconds, if present in the URL (`t=` or `start=`). */
  start?: number;
};

export type VimeoInfo = {
  videoId: string;
};

/* ── URL helpers ───────────────────────────────────────────────────────── */

/** Attempt to construct a URL. Returns null when invalid. */
function tryParseUrl(raw: string): URL | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // Support protocol-relative or bare inputs by defaulting to https://
    if (/^https?:\/\//i.test(trimmed)) return new URL(trimmed);
    if (trimmed.startsWith('//')) return new URL(`https:${trimmed}`);
    return new URL(`https://${trimmed}`);
  } catch {
    return null;
  }
}

/** Convert a `1h2m3s` / `90` / `"90"` style timestamp into seconds. */
function parseTimestamp(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Pure number → seconds
  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  // 1h2m3s pattern (any unit optional)
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed);
  if (!match) return undefined;
  const [, h, m, s] = match;
  const total =
    (h ? Number.parseInt(h, 10) * 3600 : 0) +
    (m ? Number.parseInt(m, 10) * 60 : 0) +
    (s ? Number.parseInt(s, 10) : 0);
  return total > 0 ? total : undefined;
}

/* ── YouTube ───────────────────────────────────────────────────────────── */

// Hoisted RegExps so we don't recompile on every call.
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YT_HOST_RE = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

/**
 * Parse a YouTube URL into `{ videoId, start? }` or `null`.
 *
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - with optional `?t=90` / `?t=1h2m3s` / `?start=90`
 */
export function parseYouTubeUrl(url: string): YouTubeInfo | null {
  const parsed = tryParseUrl(url);
  if (!parsed) return null;
  if (!YT_HOST_RE.test(parsed.hostname)) return null;

  let videoId: string | null = null;

  if (/(^|\.)youtu\.be$/i.test(parsed.hostname)) {
    // youtu.be/VIDEO_ID
    videoId = parsed.pathname.replace(/^\//, '').split('/')[0] || null;
  } else if (parsed.pathname === '/watch') {
    videoId = parsed.searchParams.get('v');
  } else {
    // /embed/VIDEO_ID, /shorts/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
    const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(parsed.pathname);
    if (match) videoId = match[1];
  }

  if (!videoId || !YT_ID_RE.test(videoId)) return null;

  const startRaw =
    parsed.searchParams.get('t') ?? parsed.searchParams.get('start');
  const start = parseTimestamp(startRaw);

  return start !== undefined ? { videoId, start } : { videoId };
}

/* ── Vimeo ─────────────────────────────────────────────────────────────── */

const VIMEO_HOST_RE = /(^|\.)vimeo\.com$/i;
const VIMEO_ID_RE = /^\d+$/;

/**
 * Parse a Vimeo URL into `{ videoId }` or `null`.
 *
 * Supports:
 * - https://vimeo.com/123456789
 * - https://vimeo.com/channels/staffpicks/123456789
 * - https://player.vimeo.com/video/123456789
 */
export function parseVimeoUrl(url: string): VimeoInfo | null {
  const parsed = tryParseUrl(url);
  if (!parsed) return null;
  if (!VIMEO_HOST_RE.test(parsed.hostname)) return null;

  const parts = parsed.pathname.split('/').filter(Boolean);
  // Scan from end for the first all-numeric segment.
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const seg = parts[i];
    if (VIMEO_ID_RE.test(seg)) return { videoId: seg };
  }
  return null;
}

/* ── TikTok / Instagram / Direct detection ────────────────────────────── */

const TIKTOK_HOST_RE = /(^|\.)(tiktok\.com|vm\.tiktok\.com)$/i;
const INSTAGRAM_HOST_RE = /(^|\.)(instagram\.com|instagr\.am)$/i;
const DIRECT_EXT_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;

/**
 * Classify an arbitrary media URL as one of the supported providers.
 * Returns `'unknown'` for invalid or unsupported URLs.
 */
export function detectMediaProvider(url: string): MediaProvider {
  const parsed = tryParseUrl(url);
  if (!parsed) return 'unknown';

  if (YT_HOST_RE.test(parsed.hostname)) return 'youtube';
  if (VIMEO_HOST_RE.test(parsed.hostname)) return 'vimeo';
  if (TIKTOK_HOST_RE.test(parsed.hostname)) return 'tiktok';
  if (INSTAGRAM_HOST_RE.test(parsed.hostname)) return 'instagram';
  if (DIRECT_EXT_RE.test(parsed.pathname)) return 'direct';
  return 'unknown';
}

/**
 * Build a YouTube embed URL from `{ videoId, start? }`, including a start
 * offset and sensible defaults (privacy-enhanced domain, modestbranding).
 */
export function buildYouTubeEmbedUrl(info: YouTubeInfo): string {
  const params = new URLSearchParams({
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });
  if (info.start && info.start > 0) params.set('start', String(info.start));
  return `https://www.youtube-nocookie.com/embed/${info.videoId}?${params.toString()}`;
}

/** Build a Vimeo embed URL from `{ videoId }`. */
export function buildVimeoEmbedUrl(info: VimeoInfo): string {
  const params = new URLSearchParams({
    byline: '0',
    portrait: '0',
    title: '0',
  });
  return `https://player.vimeo.com/video/${info.videoId}?${params.toString()}`;
}
