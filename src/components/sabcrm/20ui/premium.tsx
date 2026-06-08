'use client';

/**
 * 20ui — Premium (landing-inspired).
 *
 * Brings the SabNode marketing brand language (the amber to rose gradient, the
 * violet/rose glows, the aurora wash, glass pills, spotlight + feature cards)
 * into the CRM as OPT-IN flourishes. Use these for flagship moments — a getting
 * started hero, an upgrade prompt, a featured stat — not the dense default UI.
 * The calm light system stays the default; nothing here fires automatically.
 */

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { renderIcon, type IconProp } from './_icon';
import './premium.css';

/** Brand-family gradients shared by the premium components. */
export type GradientTone = 'brand' | 'violet' | 'sky' | 'rose' | 'emerald';

/* ---------------------------------------------------------------- GradientText */

export interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: GradientTone;
  /** Animated brand underline that draws in once on mount. */
  underline?: boolean;
}

/** Clip-text gradient for hero headlines + key emphasis. Use sparingly. */
export function GradientText({
  tone = 'brand',
  underline = false,
  className,
  children,
  ...rest
}: GradientTextProps): React.JSX.Element {
  return (
    <span
      className={['u-gtext', `u-gtext--${tone}`, underline && 'u-gtext--underline', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- GradientIcon */

export interface GradientIconProps {
  icon: IconProp;
  tone?: GradientTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A gradient-filled rounded icon chip (the landing's module icon). */
export function GradientIcon({
  icon,
  tone = 'brand',
  size = 'md',
  className,
}: GradientIconProps): React.JSX.Element {
  const px = size === 'sm' ? 14 : size === 'lg' ? 22 : 18;
  return (
    <span
      className={['u-gicon', `u-gicon--${tone}`, `u-gicon--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {renderIcon(icon, { size: px })}
    </span>
  );
}

/* ---------------------------------------------------------------- GlassPill */

export interface GlassPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  icon?: IconProp;
}

/** A frosted-glass eyebrow pill (the landing's hero label). */
export function GlassPill({
  icon,
  className,
  children,
  ...rest
}: GlassPillProps): React.JSX.Element {
  return (
    <span className={['u-glasspill', className].filter(Boolean).join(' ')} {...rest}>
      {renderIcon(icon, { size: 13, 'aria-hidden': true })}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- Aurora */

export interface AuroraProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Glow strength. */
  intensity?: 'soft' | 'normal' | 'strong';
}

/** An ambient radial-glow backdrop (the signature hero wash). Wrap content. */
export function Aurora({
  intensity = 'normal',
  className,
  children,
  ...rest
}: AuroraProps): React.JSX.Element {
  return (
    <div className={['u-aurora-wrap', `u-aurora-wrap--${intensity}`, className].filter(Boolean).join(' ')} {...rest}>
      <span className="u-aurora-wash" aria-hidden="true" />
      <div className="u-aurora-content">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- SpotlightCard */

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Glow colour that follows the cursor. */
  tone?: GradientTone;
}

/**
 * A card whose soft glow tracks the cursor (premium feature surfaces). The glow
 * is driven by CSS custom properties updated on pointer move — no React state,
 * no re-renders. Degrades to a calm static card under reduced motion / touch.
 */
export function SpotlightCard({
  tone = 'brand',
  className,
  children,
  onMouseMove,
  ...rest
}: SpotlightCardProps): React.JSX.Element {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el) {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--u-mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--u-my', `${e.clientY - r.top}px`);
      }
      onMouseMove?.(e);
    },
    [onMouseMove],
  );

  return (
    <div
      ref={ref}
      className={['u-spotlight', `u-spotlight--${tone}`, className].filter(Boolean).join(' ')}
      onMouseMove={handleMove}
      {...rest}
    >
      <span className="u-spotlight__glow" aria-hidden="true" />
      <div className="u-spotlight__inner">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- FeatureTile */

export interface FeatureTileProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon: IconProp;
  tone?: GradientTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Optional trailing slot (badge, arrow, etc.). */
  trailing?: React.ReactNode;
}

/** A premium feature card — gradient icon + copy, lift + glow on hover. */
export function FeatureTile({
  icon,
  tone = 'brand',
  title,
  description,
  trailing,
  className,
  ...rest
}: FeatureTileProps): React.JSX.Element {
  return (
    <div className={['u-feature', `u-feature--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      <span className="u-feature__glow" aria-hidden="true" />
      <div className="u-feature__head">
        <GradientIcon icon={icon} tone={tone} />
        {trailing ? <span className="u-feature__trailing">{trailing}</span> : null}
      </div>
      <h3 className="u-feature__title">{title}</h3>
      {description ? <p className="u-feature__desc">{description}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- GlowBadge */

export interface GlowBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: GradientTone;
  icon?: IconProp;
}

/** A small gradient-filled badge for flagship labels ("New", "Pro"). */
export function GlowBadge({
  tone = 'brand',
  icon,
  className,
  children,
  ...rest
}: GlowBadgeProps): React.JSX.Element {
  return (
    <span className={['u-glowbadge', `u-glowbadge--${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {renderIcon(icon, { size: 11, 'aria-hidden': true })}
      {children}
    </span>
  );
}
