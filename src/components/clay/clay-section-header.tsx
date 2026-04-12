'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClaySectionHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  actions?: React.ReactNode;
  subtitle?: string;
  size?: 'md' | 'lg';
}

/**
 * ClaySectionHeader — the "Round" / "Interview Overview" heading +
 * optional trailing action buttons (+ · ··· · pill).
 */
export function ClaySectionHeader({
  title,
  subtitle,
  actions,
  size = 'md',
  className,
  ...props
}: ClaySectionHeaderProps) {
  return (
    <div
      className={cn('flex items-center justify-between gap-4', className)}
      {...props}
    >
      <div className="min-w-0">
        <h2
          className={cn(
            'font-semibold tracking-tight text-clay-ink leading-none',
            size === 'lg' ? 'text-[28px]' : 'text-[22px]',
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-clay-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
