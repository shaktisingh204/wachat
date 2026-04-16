'use client';

import { useState, useCallback } from 'react';
import { LuImageOff, LuLoader } from 'react-icons/lu';
import { Lightbox } from './Lightbox';

export interface ImageBubbleProps {
  /** Image URL. If empty/invalid, renders an error placeholder. */
  url: string;
  /** Accessible alt text. */
  alt?: string;
  /** Optional click-through link (overrides the lightbox). */
  link?: string;
  /** Max CSS width. Defaults to `280px`. */
  maxWidth?: string;
  /** Bubble background colour, used for the error placeholder surface. */
  backgroundColor?: string;
  /** Text colour for the error placeholder. */
  color?: string;
}

/**
 * Image bubble renderer.
 *
 * - Lazy-loaded.
 * - Click opens a full-screen Lightbox (unless `link` is provided).
 * - If the image fails to load, renders an `LuImageOff` fallback.
 */
export function ImageBubble({
  url,
  alt,
  link,
  maxWidth = '280px',
  backgroundColor = 'var(--gray-3)',
  color = 'var(--gray-11)',
}: ImageBubbleProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleClick = useCallback(() => {
    if (errored) return;
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    setLightboxOpen(true);
  }, [link, errored]);

  /* ── Missing URL ─────────────────────────────────────────────── */
  if (!url || typeof url !== 'string' || !url.trim()) {
    return (
      <div className="flex justify-start">
        <div
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <LuImageOff className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span>No image URL</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-start">
        <button
          type="button"
          onClick={handleClick}
          aria-label={alt ?? 'Open image'}
          className="group relative block overflow-hidden rounded-2xl rounded-tl-sm shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{ maxWidth, backgroundColor }}
        >
          {/* Loading shimmer */}
          {!loaded && !errored && (
            <div
              className="flex items-center justify-center"
              style={{
                width: maxWidth,
                aspectRatio: '4 / 3',
                backgroundColor,
              }}
            >
              <LuLoader
                className="h-5 w-5 animate-spin"
                strokeWidth={2}
                style={{ color }}
              />
            </div>
          )}

          {/* Error fallback */}
          {errored && (
            <div
              className="flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-[12px]"
              style={{
                width: maxWidth,
                aspectRatio: '4 / 3',
                color,
              }}
            >
              <LuImageOff className="h-6 w-6" strokeWidth={1.5} />
              <span>Image failed to load</span>
            </div>
          )}

          {/* Image itself */}
          {!errored && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={alt ?? ''}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(false);
              }}
              className="block h-auto w-full object-cover transition-opacity duration-300"
              style={{
                opacity: loaded ? 1 : 0,
                position: loaded ? 'static' : 'absolute',
                inset: 0,
              }}
            />
          )}
        </button>
      </div>

      {lightboxOpen && !errored && (
        <Lightbox
          images={[{ url, alt }]}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
