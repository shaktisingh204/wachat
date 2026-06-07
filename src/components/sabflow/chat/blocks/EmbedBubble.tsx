'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

import { Button, Spinner } from '@/components/sabcrm/20ui';

export interface EmbedBubbleProps {
  /** URL to embed. */
  url: string;
  /**
   * CSS aspect ratio, e.g. `"16/9"`, `"4/3"`, `"1/1"`.
   * When `height` is also set, `height` wins.
   */
  aspectRatio?: string;
  /** Explicit height (e.g. `"420px"`, `"80%"`). Overrides `aspectRatio`. */
  height?: string;
  /** Max CSS width. Defaults to `420px`. */
  maxWidth?: string;
  /** Bubble background / text colours (used by the error fallback). */
  backgroundColor?: string;
  color?: string;
}

/** Small guard, only allow embedding of http(s) URLs. */
function isSafeEmbedUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Generic iframe embed renderer.
 *
 * - Sandbox + referrerPolicy set for safety.
 * - Loading spinner until the iframe's onLoad fires.
 * - Timeout-based error fallback: if the iframe never loads (e.g. blocked by
 *   the target's X-Frame-Options / frame-ancestors CSP), we surface an
 *   "open in new tab" fallback after ~8s.
 */
export function EmbedBubble({
  url,
  aspectRatio = '16 / 9',
  height,
  maxWidth = '420px',
  backgroundColor = 'var(--st-bg-secondary)',
  color = 'var(--st-text-secondary)',
}: EmbedBubbleProps) {
  const safe = useMemo(() => isSafeEmbedUrl(url), [url]);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Reset state when the URL changes. */
  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [url]);

  /* If the iframe never loads, surface an error after 8s. */
  useEffect(() => {
    if (!safe || loaded || errored) return undefined;
    timeoutRef.current = setTimeout(() => {
      setErrored(true);
    }, 8000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [safe, loaded, errored]);

  if (!safe) {
    return (
      <div className="ui20 flex justify-start">
        <div
          className="flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          <span>Invalid embed URL</span>
        </div>
      </div>
    );
  }

  if (errored) {
    return (
      <div className="ui20 flex justify-start">
        <div
          className="flex flex-col items-start gap-2 rounded-2xl rounded-tl-sm px-4 py-3 text-[12.5px]"
          style={{ backgroundColor, color, maxWidth }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span>This site cannot be embedded here.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconRight={ExternalLink}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            Open in new tab
          </Button>
        </div>
      </div>
    );
  }

  const style: React.CSSProperties = height
    ? { width: '100%', maxWidth, height, backgroundColor }
    : { width: '100%', maxWidth, aspectRatio, backgroundColor };

  return (
    <div className="ui20 flex justify-start">
      <div
        className="relative overflow-hidden rounded-2xl rounded-tl-sm shadow-sm"
        style={style}
      >
        {/* Loading spinner overlay */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <Spinner size="md" label="Loading embed" />
          </div>
        )}

        <iframe
          src={url}
          title="Embedded content"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={() => {
            setLoaded(true);
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          }}
          onError={() => setErrored(true)}
          className="absolute inset-0 h-full w-full border-0 transition-opacity duration-200 ease-out"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
