'use client';

/**
 * SabChip — small status / label pill.
 *
 * Variants map to semantic tokens. Tone auto-selects colour + background
 * so usages don't need to hand-roll Tailwind class combinations.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type SabChipVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface SabChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: SabChipVariant;
  dot?: boolean;
  size?: 'sm' | 'md';
}

function getVariantStyle(variant: SabChipVariant): React.CSSProperties {
  const map: Record<SabChipVariant, { bg: string; fg: string; ring: string; dot: string }> = {
    neutral: {
      bg: 'hsl(var(--sab-bg-subtle))',
      fg: 'hsl(var(--sab-fg-muted))',
      ring: 'hsl(var(--sab-border))',
      dot: 'hsl(var(--sab-fg-muted))',
    },
    primary: {
      bg: 'hsl(var(--sab-primary-soft))',
      fg: 'hsl(var(--sab-primary))',
      ring: 'hsl(var(--sab-primary) / 0.30)',
      dot: 'hsl(var(--sab-primary))',
    },
    success: {
      bg: 'hsl(var(--sab-success-soft))',
      fg: 'hsl(var(--sab-success))',
      ring: 'hsl(var(--sab-success) / 0.30)',
      dot: 'hsl(var(--sab-success))',
    },
    warning: {
      bg: 'hsl(var(--sab-warning-soft))',
      fg: 'hsl(var(--sab-warning))',
      ring: 'hsl(var(--sab-warning) / 0.30)',
      dot: 'hsl(var(--sab-warning))',
    },
    danger: {
      bg: 'hsl(var(--sab-danger-soft))',
      fg: 'hsl(var(--sab-danger))',
      ring: 'hsl(var(--sab-danger) / 0.30)',
      dot: 'hsl(var(--sab-danger))',
    },
    info: {
      bg: 'hsl(var(--sab-info-soft))',
      fg: 'hsl(var(--sab-info))',
      ring: 'hsl(var(--sab-info) / 0.30)',
      dot: 'hsl(var(--sab-info))',
    },
  };
  const c = map[variant];
  return {
    background: c.bg,
    color: c.fg,
    boxShadow: `0 0 0 1px ${c.ring} inset`,
  };
}

function getDotColor(variant: SabChipVariant): string {
  return {
    neutral: 'hsl(var(--sab-fg-muted))',
    primary: 'hsl(var(--sab-primary))',
    success: 'hsl(var(--sab-success))',
    warning: 'hsl(var(--sab-warning))',
    danger: 'hsl(var(--sab-danger))',
    info: 'hsl(var(--sab-info))',
  }[variant];
}

export function SabChip({
  variant = 'neutral',
  dot,
  size = 'md',
  className,
  children,
  style,
  ...props
}: SabChipProps) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center gap-1.5 font-medium tabular-nums',
        size === 'sm'
          ? 'h-5 rounded-[6px] px-1.5 text-[10.5px]'
          : 'h-6 rounded-[8px] px-2 text-[11.5px]',
        className,
      )}
      style={{ ...getVariantStyle(variant), ...style }}
      {...props}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: getDotColor(variant) }}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
