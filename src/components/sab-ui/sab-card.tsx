'use client';

/**
 * SabCard — layered content container with the Aurora aesthetic.
 *
 * Four visual variants (default / featured / hero / bordered) that each
 * layer on more atmosphere:
 *
 *   default  — plain surface + hairline border + xs shadow (the existing look)
 *   featured — surface + subtle gradient overlay + md shadow
 *   hero     — gradient border (violet → transparent) + colored glow + lg shadow
 *   bordered — plain surface + 1.5px border, no shadow (for nested containers)
 *
 * Also adds optional `glow` prop (primary | success | danger | info | none)
 * that paints a colored shadow halo below the card.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SabCardVariant = 'default' | 'featured' | 'hero' | 'bordered';
export type SabCardGlow = 'none' | 'primary' | 'success' | 'danger' | 'info';

export interface SabCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Interactive lift on hover (for clickable cards). */
  interactive?: boolean;
  /** Tinted background — for featured / empty cards. */
  tinted?: boolean;
  /** Render without the outer border — for nested cards. */
  flush?: boolean;
  /** Visual variant, adds gradient borders / glows. */
  variant?: SabCardVariant;
  /** Optional colored glow halo — great for hero cards. */
  glow?: SabCardGlow;
}

function getGlow(glow: SabCardGlow): string | undefined {
  switch (glow) {
    case 'primary': return 'var(--sab-glow-primary)';
    case 'success': return 'var(--sab-glow-success)';
    case 'danger':  return 'var(--sab-glow-danger)';
    case 'info':    return 'var(--sab-glow-info)';
    default:        return undefined;
  }
}

export const SabCard = React.forwardRef<HTMLDivElement, SabCardProps>(
  (
    {
      className,
      interactive,
      tinted,
      flush,
      variant = 'default',
      glow = 'none',
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const glowShadow = getGlow(glow);
    const baseShadow =
      variant === 'hero'
        ? 'var(--sab-shadow-lg)'
        : variant === 'featured'
          ? 'var(--sab-shadow-md)'
          : variant === 'bordered'
            ? 'none'
            : interactive
              ? 'var(--sab-shadow-sm)'
              : 'var(--sab-shadow-xs)';

    const isGradientBorder = variant === 'hero';

    const background = tinted
      ? 'hsl(var(--sab-bg-subtle))'
      : variant === 'featured'
        ? 'linear-gradient(180deg, hsl(var(--sab-surface)) 0%, hsl(var(--sab-bg-subtle)) 100%)'
        : 'hsl(var(--sab-surface))';

    return (
      <div
        ref={ref}
        className={cn(
          'sab-card relative flex flex-col overflow-hidden transition-[box-shadow,transform] duration-200 ease-out',
          interactive && 'cursor-pointer hover:-translate-y-[2px]',
          isGradientBorder && 'sab-gradient-border',
          className,
        )}
        style={{
          background,
          border: isGradientBorder || flush
            ? undefined
            : `1px solid hsl(var(--sab-border))`,
          borderRadius: variant === 'hero' ? 'var(--sab-radius-xl)' : 'var(--sab-radius-lg)',
          boxShadow: glowShadow ? `${baseShadow}, ${glowShadow}` : baseShadow,
          color: 'hsl(var(--sab-fg))',
          ...style,
        }}
        onMouseEnter={
          interactive
            ? (e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.boxShadow = glowShadow
                  ? `var(--sab-shadow-lg), ${glowShadow}`
                  : 'var(--sab-shadow-md)';
              }
            : undefined
        }
        onMouseLeave={
          interactive
            ? (e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.boxShadow = glowShadow
                  ? `${baseShadow}, ${glowShadow}`
                  : baseShadow;
              }
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    );
  },
);
SabCard.displayName = 'SabCard';

/* -------------------------------------------------------------------------- */
/*  Header / Body / Footer                                                    */
/* -------------------------------------------------------------------------- */

export interface SabCardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SabCardHeader = React.forwardRef<HTMLDivElement, SabCardHeaderProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-4 px-6 py-5', className)}
      style={{ borderBottom: '1px solid hsl(var(--sab-border))' }}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {title ? (
          <div className="text-[15px] font-semibold leading-tight" style={{ color: 'hsl(var(--sab-fg))' }}>
            {title}
          </div>
        ) : null}
        {description ? (
          <div className="text-[13px] leading-snug" style={{ color: 'hsl(var(--sab-fg-muted))' }}>
            {description}
          </div>
        ) : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  ),
);
SabCardHeader.displayName = 'SabCardHeader';

export const SabCardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }
>(({ className, flush, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex-1', flush ? '' : 'px-6 py-5', className)}
    {...props}
  />
));
SabCardBody.displayName = 'SabCardBody';

export const SabCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between gap-4 px-6 py-4', className)}
    style={{ borderTop: '1px solid hsl(var(--sab-border))' }}
    {...props}
  />
));
SabCardFooter.displayName = 'SabCardFooter';
