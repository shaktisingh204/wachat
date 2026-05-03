'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ClayListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  /**
   * Expanded state — shows children below the row. Still renders
   * the row in the default soft treatment (NOT rose-tinted); the
   * reference only lifts the index circle to a hairline-bordered
   * cream circle when the row is the one being edited.
   */
  expanded?: boolean;
  children?: React.ReactNode;
}

/**
 * ClayListRow — the numbered (1 / 2 / 3) rows in the "Previous Background"
 * / "Editing" section of the reference.
 *
 * Structure matches the reference exactly:
 *   [circle w/ number]  [title + meta]                 [trailing icons]
 *   ─────────── optional children (form, guidelines) ───────────
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
        'flex flex-col rounded-xl border border-border bg-secondary',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        {/* Numbered circle — reference uses a pure circle, not a square */}
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
            'bg-muted text-muted-foreground border border-border',
          )}
        >
          {index}
        </div>
        <div className="min-w-0 flex-1 pt-[3px]">
          <div className="text-[14px] font-medium text-foreground leading-tight">
            {title}
          </div>
          {meta ? (
            <div className="mt-1 text-[12px] text-muted-foreground leading-tight">
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
        <div className="border-t border-border px-4 py-4">{children}</div>
      ) : null}
    </div>
  );
}
