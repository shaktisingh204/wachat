'use client';

import { useState, useCallback } from 'react';
import { ImageOff } from 'lucide-react';
import { Button, Spinner } from '@/components/sabcrm/20ui';
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
 * - If the image fails to load, renders an `ImageOff` fallback.
 */
export function ImageBubble({
  url,
  alt,
  link,
  maxWidth = '280px',
  backgroundColor = 'var(--st-bg-secondary)',
  color = 'var(--st-text-secondary)',
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

  /* Missing URL */
  if (!url || typeof url !== 'string' || !url.trim()) {
    return (
      <div className="flex justify-start">
        <div
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-[var(--st-border)] px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <ImageOff className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>No image URL</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-start">
        <Button
          variant="ghost"
          onClick={handleClick}
          aria-label={alt ?? 'Open image'}
          className="group relative !block h-auto !p-0 overflow-hidden rounded-2xl rounded-tl-sm shadow-sm"
          style={{ maxWidth, backgroundColor }}
        >
          {/* Loading state */}
          {!loaded && !errored && (
            <div
              className="flex aspect-[4/3] items-center justify-center"
              style={{ width: maxWidth, backgroundColor }}
            >
              <Spinner size="md" label="Loading image" />
            </div>
          )}

          {/* Error fallback */}
          {errored && (
            <div
              className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 px-6 py-8 text-[12px]"
              style={{ width: maxWidth, color }}
            >
              <ImageOff className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
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
                inset: loaded ? undefined : 0,
              }}
            />
          )}
        </Button>
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
