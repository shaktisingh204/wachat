'use client';

import * as React from 'react';
import { GripVertical, ListTree } from 'lucide-react';

import { Button, EmptyState } from '@/components/sabcrm/20ui';
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
  /** Copy shown when there are no items. */
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
}

/**
 * ClaySectionList - a vertical list of selectable section rows built on the
 * 20ui Button. Each row is a ghost, full-width pressable that lays out its
 * title + optional meta on the left and surfaces a drag-handle affordance on
 * the right edge. Falls back to a 20ui EmptyState when there are no items.
 */
export function ClaySectionList({
  items,
  emptyTitle = 'No sections yet',
  emptyDescription = 'Add a section to start organizing this layout.',
  className,
  ...props
}: ClaySectionListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        <EmptyState
          size="sm"
          icon={ListTree}
          title={emptyTitle}
          description={emptyDescription}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} {...props}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map((item) => (
          <li key={item.key}>
            <Button
              variant="ghost"
              block
              onClick={item.onClick}
              iconRight={GripVertical}
              className="h-auto justify-between gap-3 whitespace-normal rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] px-3.5 py-3 text-left hover:bg-[var(--st-hover)]"
            >
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                <span className="w-full truncate text-[13px] font-semibold text-[var(--st-text)]">
                  {item.title}
                </span>
                {item.meta ? (
                  <span className="text-[11px] text-[var(--st-text-secondary)]">
                    {item.meta}
                  </span>
                ) : null}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
