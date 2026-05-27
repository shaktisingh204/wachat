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
 * ClaySectionList — semantic <ul> of selectable section rows. Each
 * row uses shadcn surface classes (`bg-zoru-surface`, `hover:bg-zoru-surface-2`)
 * and surfaces a drag-handle affordance on the right edge.
 */
export function ClaySectionList({
  items,
  className,
  ...props
}: ClaySectionListProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      <ul className="flex flex-col gap-2 m-0 p-0 list-none">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={item.onClick}
              className="group flex w-full items-center justify-between gap-3 rounded-lg bg-zoru-surface px-3.5 py-3 text-left transition-colors hover:bg-zoru-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-zoru-ink truncate">
                  {item.title}
                </div>
                {item.meta ? (
                  <div className="mt-0.5 text-[11px] text-zoru-ink-muted">
                    {item.meta}
                  </div>
                ) : null}
              </div>
              <LuGripVertical
                className="h-4 w-4 shrink-0 text-zoru-ink-muted/70 group-hover:text-zoru-ink-muted transition-colors"
                strokeWidth={1.75}
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
