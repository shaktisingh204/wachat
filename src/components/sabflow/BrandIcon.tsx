'use client';

import { useState, type ReactNode } from 'react';
import { Icon } from '@iconify/react';

type Props = {
  /** Local vendored path (`/brand-logos/slack.svg`) or iconify name (`logos:slack-icon`). */
  icon: string;
  className?: string;
  fallback?: ReactNode;
  /** Accepted for call-site compatibility — the icon is always aria-hidden. */
  'aria-hidden'?: boolean;
};

/**
 * Brand logo renderer for the SabFlow app catalog.
 *
 * Locally vendored SVG/PNG marks (scraped by `scripts/fetch-brand-logos.mjs`
 * into `public/brand-logos/`) render as a plain `<img>` — no runtime icon
 * CDN, browser-cacheable, zero JS bundle cost. Iconify names keep the
 * existing `@iconify/react` behavior for the explicit overrides table.
 */
export function BrandIcon({ icon, className, fallback }: Props) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback ?? null}</>;
  if (icon.startsWith('/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static same-origin SVG, next/image adds nothing
      <img
        src={icon}
        alt=""
        aria-hidden
        draggable={false}
        loading="lazy"
        decoding="async"
        className={className ? `${className} object-contain` : 'object-contain'}
        onError={() => setFailed(true)}
      />
    );
  }
  return <Icon icon={icon} className={className} fallback={fallback} aria-hidden />;
}
