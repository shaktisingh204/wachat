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
          ? 'border-clay-obsidian bg-clay-obsidian text-white hover:bg-clay-obsidian-hover'
          : 'border-clay-border bg-clay-surface text-clay-ink hover:bg-clay-surface-2',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-clay-sm',
            tone === 'obsidian'
              ? 'bg-white/10 text-white'
              : 'bg-clay-bg-2 text-clay-ink-muted',
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
          tone === 'obsidian' ? 'text-white/70' : 'text-clay-ink-fade',
        )}
        strokeWidth={2}
      />
    </button>
  );
}
