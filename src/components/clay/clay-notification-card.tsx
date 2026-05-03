'use client';

import * as React from 'react';
import { LuArrowUpRight } from 'react-icons/lu';
import { Card } from '@/components/ui/card';
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
 * shadcn `Card` shaped as a button via the `asChild`-friendly
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
            ? 'bg-foreground text-background hover:bg-foreground/90'
            : 'hover:bg-secondary',
        )}
      >
        {icon ? (
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              isObsidian
                ? 'bg-background/10 text-background'
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
            isObsidian ? 'text-background/70' : 'text-muted-foreground/70',
          )}
          strokeWidth={2}
        />
      </Card>
    </button>
  );
}
