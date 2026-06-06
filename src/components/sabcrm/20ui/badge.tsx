'use client';

/**
 * 20ui — Badge, Tag, Dot.
 *
 * Badge: a small status/label pill (tones × styles). Tag: a removable,
 * colour-dotted chip (record tags). Dot: a bare status indicator. Colour is used
 * only to carry meaning (status / category), never for decoration.
 */

import * as React from 'react';
import { X } from 'lucide-react';

import './badge.css';

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';
export type BadgeStyleKind = 'soft' | 'solid' | 'outline';

/** Back-compat (shadcn/legacy ZoruUI) variant names, mapped to tone + kind. */
export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'accent';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  kind?: BadgeStyleKind;
  /** Leading status dot. */
  dot?: boolean;
  /** Back-compat variant; mapped to tone (+ outline kind) when `tone` is absent. */
  variant?: BadgeVariant;
}

const BADGE_VARIANT_TONE: Record<BadgeVariant, BadgeTone> = {
  default: 'neutral',
  secondary: 'neutral',
  destructive: 'danger',
  outline: 'neutral',
  success: 'success',
  warning: 'warning',
  info: 'info',
  accent: 'accent',
};

export function Badge({
  tone,
  kind,
  dot = false,
  variant,
  className,
  children,
  ...rest
}: BadgeProps): React.JSX.Element {
  const resolvedTone: BadgeTone =
    tone ?? (variant ? BADGE_VARIANT_TONE[variant] ?? 'neutral' : 'neutral');
  const resolvedKind: BadgeStyleKind = kind ?? (variant === 'outline' ? 'outline' : 'soft');
  const cls = ['u-badge', `u-badge--${resolvedTone}`, `u-badge--${resolvedKind}`, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {dot ? <span className="u-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Concrete colour for the dot (hex/rgb/var). */
  color?: string;
  /** Shows a remove (×) affordance; fires onRemove. */
  onRemove?: () => void;
  removeLabel?: string;
}

/** A record tag — colour dot + label, optionally removable. */
export function Tag({
  color,
  onRemove,
  removeLabel = 'Remove tag',
  className,
  children,
  ...rest
}: TagProps): React.JSX.Element {
  return (
    <span className={['u-tag', className].filter(Boolean).join(' ')} {...rest}>
      <span
        className="u-tag__dot"
        style={color ? { background: color } : undefined}
        aria-hidden="true"
      />
      <span className="u-tag__label">{children}</span>
      {onRemove ? (
        <button
          type="button"
          className="u-tag__remove"
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X size={11} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

export interface DotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Add a soft pulsing ring (e.g. "live"). */
  pulse?: boolean;
}

/** A bare status dot. `label` (via aria-label) carries meaning to AT. */
export function Dot({ tone = 'neutral', pulse = false, className, ...rest }: DotProps): React.JSX.Element {
  return (
    <span
      className={['u-dot', `u-dot--${tone}`, pulse && 'u-dot--pulse', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
}

export default Badge;
