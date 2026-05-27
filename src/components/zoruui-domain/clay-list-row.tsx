'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /**
   * Expanded state — shows children below the row.
   */
  expanded?: boolean;
  children?: React.ReactNode;
}

/**
 * ClayListRow — composed from shadcn-friendly tokens (`bg-card`,
 * `bg-secondary`, etc.) without depending on a single primitive.
 * The structure mirrors the original: numbered circle + title/meta +
 * trailing slot + optional expanded children area.
 */
export function ClayListRow({
  index,
  title,
  meta,
  trailing,
  expanded = false,
  className,
  children,
  ...props
}: ClayListRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl bg-secondary',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
            'bg-muted text-muted-foreground',
          )}
        >
          {index}
        </div>
        <div className="min-w-0 flex-1 pt-[3px]">
          <div className="text-sm font-medium text-foreground leading-tight">
            {title}
          </div>
          {meta ? (
            <div className="mt-1 text-xs text-muted-foreground leading-tight">
              {meta}
            </div>
          ) : null}
        </div>
        {trailing ? (
          <div className="flex shrink-0 items-center gap-1 pt-[1px]">
            {trailing}
          </div>
        ) : null}
      </div>
      {expanded && children ? (
        <div className="px-4 py-4 border-t border-border/50">{children}</div>
      ) : null}
    </div>
  );
}
