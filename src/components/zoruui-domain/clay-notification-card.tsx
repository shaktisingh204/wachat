'use client';

import { Card } from '@/components/sabcrm/20ui';
import { LuArrowUpRight } from 'react-icons/lu';

import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ClayNotificationCardProps {
  icon?: React.ReactNode;
  title: string;
  tone?: 'default' | 'obsidian';
  onClick?: () => void;
  className?: string;
}

/**
 * ClayNotificationCard — small stacked notification pills. Renders a
 * shadcn `ZoruCard` shaped as a button via the `asChild`-friendly
 * pattern: we wrap a real <button> around the Card so the whole row
 * is keyboard- and click-accessible.
 */
export function ClayNotificationCard({
  icon,
  title,
  tone = 'default',
  onClick,
  className,
}: ClayNotificationCardProps) {
  const isObsidian = tone === 'obsidian';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group block w-full text-left', className)}
    >
      <Card
        variant="default"
        className={cn(
          'flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 transition-colors',
          isObsidian
            ? 'bg-[var(--st-text)] text-[var(--st-bg-secondary)] hover:bg-[var(--st-text)]/90'
            : 'hover:bg-[var(--st-bg-muted)]',
        )}
      >
        {icon ? (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              isObsidian
                ? 'bg-[var(--st-bg-secondary)]/10 text-[var(--st-bg-secondary)]'
                : 'bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]',
            )}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
          {title}
        </span>
        <LuArrowUpRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
            isObsidian ? 'text-[var(--st-bg-secondary)]/70' : 'text-[var(--st-text-secondary)]/70',
          )}
          strokeWidth={2}
        />
      </Card>
    </button>
  );
}
