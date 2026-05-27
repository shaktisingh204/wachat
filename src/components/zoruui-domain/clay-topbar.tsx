'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayTopbarProps extends React.HTMLAttributes<HTMLElement> {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
}

/**
 * ClayTopbar — flat row of pill groups. Slot-based: the actual pill
 * buttons are composed by the caller (typically `<ClayButton variant="pill">`).
 * Restyled to consume shadcn tokens (`bg-card`, `border-border`).
 */
export function ClayTopbar({
  left,
  center,
  right,
  className,
  ...props
}: ClayTopbarProps) {
  return (
    <header
      className={cn(
        'relative flex w-full shrink-0 items-center justify-between border-b border-border bg-card text-card-foreground',
        'h-[68px] px-5',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-2">{left}</div>
      {center ? (
        <div className="flex items-center gap-2">{center}</div>
      ) : null}
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}
