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
 * ClaySectionHeader — semantic <header> with shadcn typography classes.
 * Renders a heading + optional subtitle on the left and a slot for
 * trailing action buttons on the right.
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
    <header
      className={cn('flex items-center justify-between gap-4', className)}
      {...props}
    >
      <div className="min-w-0">
        <h2
          className={cn(
            'font-semibold tracking-tight text-foreground leading-none',
            size === 'lg' ? 'text-3xl' : 'text-2xl',
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
