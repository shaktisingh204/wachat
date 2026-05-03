'use client';

import * as React from 'react';
import { LuArrowUpRight } from 'react-icons/lu';
import { cn } from '@/lib/utils';

export interface ClayNotificationCardProps {
  icon?: React.ReactNode;
  title: string;
  tone?: 'default' | 'obsidian';
  onClick?: () => void;
  className?: string;
}

/**
 * ClayNotificationCard — the small stacked notification pills on the
 * right side of the reference ("PRO mode activated", "New candidate
 * added", "New deadline soon").
 */
export function ClayNotificationCard({
  icon,
  title,
  tone = 'default',
  onClick,
  className,
}: ClayNotificationCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors',
        tone === 'obsidian'
          ? 'border-foreground bg-foreground text-white hover:bg-foreground/90'
          : 'border-border bg-card text-foreground hover:bg-secondary',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            tone === 'obsidian'
              ? 'bg-white/10 text-white'
              : 'bg-muted text-muted-foreground',
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
          tone === 'obsidian' ? 'text-white/70' : 'text-muted-foreground/70',
        )}
        strokeWidth={2}
      />
    </button>
  );
}
