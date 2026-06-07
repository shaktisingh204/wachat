'use client';

import { Card } from '@/components/sabcrm/20ui';
import { LuArrowUpRight } from 'react-icons/lu';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

export interface ClayModuleTileProps {
  /** React node (an icon) — rendered in the accent square top-left */
  icon: React.ReactNode;
  name: string;
  /** Large primary stat, e.g. "12.4k sent" */
  primary: string;
  /** Small secondary line, e.g. "94% delivered" */
  secondary?: string;
  href: string;
  /** Accent tint for the icon square. Defaults to soft rose. */
  accent?:
    | 'rose'
    | 'obsidian'
    | 'violet'
    | 'amber'
    | 'green'
    | 'blue'
    | 'orange'
    | 'pink'
    | 'teal'
    | 'lime'
    | 'indigo'
    | 'slate';
  /** Optional status dot next to the primary metric */
  status?: 'ok' | 'warn' | 'off';
  className?: string;
}

const accentClasses: Record<NonNullable<ClayModuleTileProps['accent']>, string> = {
  rose:     'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
  obsidian: 'bg-[var(--st-text)] text-[var(--st-bg-secondary)]',
  violet:   'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
  amber:    'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  green:    'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  blue:     'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
  orange:   'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  pink:     'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  teal:     'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  lime:     'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
  indigo:   'bg-[var(--st-bg-muted)] text-[var(--st-text)]',
  slate:    'bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
};

const statusClasses = {
  ok:   'bg-[var(--st-text)]',
  warn: 'bg-[var(--st-text)]',
  off:  'bg-[var(--st-text)]/70',
};

/**
 * ClayModuleTile — compact, clickable tile surfacing one module's
 * primary metric. Wraps the shadcn `ZoruCard` primitive in a `next/link`
 * so the whole tile is navigable.
 */
export function ClayModuleTile({
  icon,
  name,
  primary,
  secondary,
  href,
  accent = 'rose',
  status,
  className,
}: ClayModuleTileProps) {
  return (
    <Link href={href} className={cn('group block', className)}>
      <Card
        variant="default"
        className={cn(
          'flex flex-col p-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md',
        )}
      >
        <div className="flex items-start justify-between">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-[10px]',
              accentClasses[accent],
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {icon}
            </span>
          </span>
          <LuArrowUpRight
            className="h-3.5 w-3.5 text-[var(--st-text-secondary)]/70 transition-[color,transform] group-hover:text-[var(--st-text)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </div>

        <div className="mt-3.5 text-xs font-medium text-[var(--st-text-secondary)] leading-none">
          {name}
        </div>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <div className="text-xl font-semibold tracking-[-0.01em] text-[var(--st-text)] leading-none">
            {primary}
          </div>
          {status ? (
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                statusClasses[status],
              )}
            />
          ) : null}
        </div>

        {secondary ? (
          <div className="mt-1 text-[11px] text-[var(--st-text-secondary)] leading-tight truncate">
            {secondary}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
