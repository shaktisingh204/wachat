'use client';

import { useMemo, useState } from 'react';
import { LuVideoOff, LuExternalLink } from 'react-icons/lu';
import {
  buildVimeoEmbedUrl,
  buildYouTubeEmbedUrl,
  detectMediaProvider,
  parseVimeoUrl,
  parseYouTubeUrl,
  type MediaProvider,
} from '../helpers/mediaParsers';

export interface VideoBubbleProps {
  /** Video URL — YouTube, Vimeo, TikTok, Instagram, or direct MP4. */
  url: string;
  /** CSS aspect ratio, e.g. `"16/9"`. Defaults to `16 / 9`. */
  aspectRatio?: string;
  /** Max CSS width. Defaults to `360px`. */
  maxWidth?: string;
  /** Autoplay (only applies to direct video elements — muted for browsers). */
  isAutoplayEnabled?: boolean;
  /** Show browser controls on direct videos (defaults true). */
  areControlsDisplayed?: boolean;
  /** Bubble background colour (used for error fallback). */
  backgroundColor?: string;
  /** Text colour (used for error fallback). */
  color?: string;
}

type ResolvedSource =
  | { kind: 'iframe'; src: string; provider: MediaProvider; title: string }
  | { kind: 'video'; src: string }
  | { kind: 'link-only'; href: string; provider: MediaProvider }
  | { kind: 'error' };

function resolveSource(url: string): ResolvedSource {
  if (!url || typeof url !== 'string' || !url.trim()) return { kind: 'error' };

  const provider = detectMediaProvider(url);

  if (provider === 'youtube') {
    const info = parseYouTubeUrl(url);
    if (!info) return { kind: 'error' };
    return {
      kind: 'iframe',
      src: buildYouTubeEmbedUrl(info),
      provider,
      title: 'YouTube video player',
    };
  }

  if (provider === 'vimeo') {
    const info = parseVimeoUrl(url);
    if (!info) return { kind: 'error' };
    return {
      kind: 'iframe',
      src: buildVimeoEmbedUrl(info),
      provider,
      title: 'Vimeo video player',
    };
  }

  if (provider === 'direct') return { kind: 'video', src: url };

  // TikTok / Instagram / unknown — their iframes reliably break with X-Frame-
  // Options / CSP when embedded cross-origin from non-whitelisted domains, so
  // we render a clickable link card instead of a dead iframe.
  if (provider === 'tiktok' || provider === 'instagram') {
    return { kind: 'link-only', href: url, provider };
  }

  // Unknown — attempt a sandboxed iframe; CSP failures will surface the
  // error fallback via the iframe's onError hook.
  return { kind: 'error' };
}

/**
 * Video bubble renderer.
 *
 * Detects the provider from the URL and renders the most appropriate player:
 * - YouTube / Vimeo → privacy-enhanced iframe embed at 16:9
 * - Direct MP4/WebM → native `<video>` with browser controls
 * - TikTok / Instagram → clickable link card (their embeds require scripts)
 * - Anything unparseable → error fallback
 */
export function VideoBubble({
  url,
  aspectRatio = '16 / 9',
  maxWidth = '360px',
  isAutoplayEnabled = false,
  areControlsDisplayed = true,
  backgroundColor = 'var(--gray-3)',
  color = 'var(--gray-11)',
}: VideoBubbleProps) {
  const source = useMemo(() => resolveSource(url), [url]);
  const [errored, setErrored] = useState(false);

  const showError = source.kind === 'error' || errored;

  if (showError) {
    return (
      <div className="flex justify-start">
        <div
          className="flex flex-col items-start gap-1.5 rounded-2xl rounded-tl-sm px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <div className="flex items-center gap-2">
            <LuVideoOff className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span>Video unavailable</span>
          </div>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11.5px] underline opacity-80 hover:opacity-100"
            >
              Open original
              <LuExternalLink className="h-3 w-3" strokeWidth={2} />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (source.kind === 'link-only') {
    const label =
      source.provider === 'tiktok' ? 'Watch on TikTok' : 'Watch on Instagram';
    return (
      <div className="flex justify-start">
        <a
          href={source.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] font-medium shadow-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor, color, maxWidth }}
        >
          <LuExternalLink className="h-4 w-4 shrink-0" strokeWidth={2} />
          {label}
        </a>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className="relative overflow-hidden rounded-2xl rounded-tl-sm shadow-sm"
        style={{ width: '100%', maxWidth, aspectRatio, backgroundColor }}
      >
        {source.kind === 'iframe' ? (
          <iframe
            src={source.src}
            title={source.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setErrored(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <video
            src={source.src}
            controls={areControlsDisplayed}
            autoPlay={isAutoplayEnabled}
            muted={isAutoplayEnabled}
            playsInline
            preload="metadata"
            onError={() => setErrored(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
    </div>
  );
}
