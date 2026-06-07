'use client';

import * as React from 'react';
import { ArrowUpRight } from 'lucide-react';

import { Card } from '@/components/sabcrm/20ui';
import { cn } from '@/lib/utils';

export interface ClayNotificationCardProps {
  icon?: React.ReactNode;
  title: string;
  tone?: 'default' | 'obsidian';
  onClick?: () => void;
  className?: string;
}

/**
 * ClayNotificationCard - a small, stacked notification pill. Built on the 20ui
 * `Card` `interactive` variant (the library's clickable-card surface, with
 * built-in hover lift, press, and focus-ring motion). Button semantics are
 * applied so the whole row stays keyboard- and click-accessible.
 */
export function ClayNotificationCard({
  icon,
  title,
  tone = 'default',
  onClick,
  className,
}: ClayNotificationCardProps) {
  const isObsidian = tone === 'obsidian';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      variant="interactive"
      padding="none"
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-[var(--st-radius)] px-3 py-2.5 text-left',
        isObsidian
          ? 'border-transparent bg-[var(--st-text)] text-[var(--st-bg-secondary)] hover:bg-[var(--st-text)]/90'
          : 'hover:bg-[var(--st-bg-secondary)]',
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            isObsidian
              ? 'bg-[var(--st-bg-secondary)]/10 text-[var(--st-bg-secondary)]'
              : 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{title}</span>
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={2}
        className={cn(
          'h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
          isObsidian
            ? 'text-[var(--st-bg-secondary)]/70'
            : 'text-[var(--st-text-secondary)]/70',
        )}
      />
    </Card>
  );
}
