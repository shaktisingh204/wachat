'use client';

import * as React from 'react';
import { LuGripVertical } from 'react-icons/lu';
import { cn } from '@/lib/utils';

export interface ClaySectionListItem {
  key: string;
  title: string;
  meta?: string;
  onClick?: () => void;
}

export interface ClaySectionListProps
  extends React.HTMLAttributes<HTMLDivElement> {
  items: ClaySectionListItem[];
}

/**
 * ClaySectionList — the "Sections" column in the reference
 * (Introduction / Portfolio Review / Background Check / Skill
 * Assessment). Each row is a soft-bordered card with title + meta
 * and a drag handle on the right edge.
 */
export function ClaySectionList({
  items,
  className,
  ...props
}: ClaySectionListProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className="group flex items-center justify-between gap-3 rounded-clay-md border border-clay-border bg-clay-surface px-3.5 py-3 text-left transition-colors hover:bg-clay-surface-2"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-clay-ink truncate">
              {item.title}
            </div>
            {item.meta ? (
              <div className="mt-0.5 text-[11px] text-clay-ink-muted">
                {item.meta}
              </div>
            ) : null}
          </div>
          <LuGripVertical
            className="h-4 w-4 shrink-0 text-clay-ink-fade group-hover:text-clay-ink-muted transition-colors"
            strokeWidth={1.75}
          />
        </button>
      ))}
    </div>
  );
}
