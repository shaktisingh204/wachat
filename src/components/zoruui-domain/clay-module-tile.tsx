'use client';

import { Card } from '@/components/zoruui';
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
  rose:     'bg-zoru-surface-2 text-zoru-ink',
  obsidian: 'bg-zoru-ink text-zoru-surface',
  violet:   'bg-zoru-surface-2 text-zoru-ink',
  amber:    'bg-zoru-surface text-zoru-ink',
  green:    'bg-zoru-surface text-zoru-ink',
  blue:     'bg-zoru-surface-2 text-zoru-ink',
  orange:   'bg-zoru-surface text-zoru-ink',
  pink:     'bg-zoru-surface text-zoru-ink',
  teal:     'bg-zoru-surface text-zoru-ink',
  lime:     'bg-zoru-surface text-zoru-ink',
  indigo:   'bg-zoru-surface-2 text-zoru-ink',
  slate:    'bg-zoru-surface text-zoru-ink',
};

const statusClasses = {
  ok:   'bg-zoru-ink',
  warn: 'bg-zoru-ink',
  off:  'bg-zoru-surface-2-foreground/70',
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
            className="h-3.5 w-3.5 text-zoru-ink-muted/70 transition-[color,transform] group-hover:text-zoru-ink group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </div>

        <div className="mt-3.5 text-xs font-medium text-zoru-ink-muted leading-none">
          {name}
        </div>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <div className="text-xl font-semibold tracking-[-0.01em] text-zoru-ink leading-none">
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
          <div className="mt-1 text-[11px] text-zoru-ink-muted leading-tight truncate">
            {secondary}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
