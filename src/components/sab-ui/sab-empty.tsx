'use client';

/**
 * SabEmpty — illustrated empty state with an optional CTA.
 *
 * Used inside SabCard bodies or as a full-page empty state. Keeps the
 * modern aesthetic through tinted backgrounds, rounded icon badges, and
 * generous spacing rather than dense table placeholders.
 */

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SabEmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** Set to 'compact' to shrink padding for inline usage in lists. */
  size?: 'compact' | 'default' | 'hero';
}

export function SabEmpty({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'default',
}: SabEmptyProps) {
  const padding =
    size === 'compact' ? 'py-10' : size === 'hero' ? 'py-24' : 'py-16';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 text-center',
        padding,
        className,
      )}
    >
      {Icon ? (
        <span
          className="flex h-14 w-14 items-center justify-center rounded-[16px]"
          style={{
            background: 'hsl(var(--sab-primary-soft))',
            color: 'hsl(var(--sab-primary))',
            boxShadow: '0 0 0 1px hsl(var(--sab-primary) / 0.12) inset',
          }}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
      ) : null}
      <div className="flex max-w-md flex-col gap-1.5">
        <div
          className="text-[15px] font-semibold leading-tight"
          style={{ color: 'hsl(var(--sab-fg))' }}
        >
          {title}
        </div>
        {description ? (
          <div
            className="text-[13px] leading-relaxed"
            style={{ color: 'hsl(var(--sab-fg-muted))' }}
          >
            {description}
          </div>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
