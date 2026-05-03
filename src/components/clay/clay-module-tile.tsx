'use client';

import * as React from 'react';
import Link from 'next/link';
import { LuArrowUpRight } from 'react-icons/lu';
import { Card } from '@/components/ui/card';
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
  rose:     'bg-accent text-accent-foreground',
  obsidian: 'bg-foreground text-background',
  violet:   'bg-[#EEE8FF] text-[#5B21B6]',
  amber:    'bg-[#FEF3C7] text-[#92400E]',
  green:    'bg-[#DCFCE7] text-[#166534]',
  blue:     'bg-[#DBEAFE] text-[#1E40AF]',
  orange:   'bg-[#FFEDD5] text-[#9A3412]',
  pink:     'bg-[#FCE7F3] text-[#9D174D]',
  teal:     'bg-[#CCFBF1] text-[#115E59]',
  lime:     'bg-[#ECFCCB] text-[#3F6212]',
  indigo:   'bg-[#E0E7FF] text-[#3730A3]',
  slate:    'bg-[#F1F5F9] text-[#334155]',
};

const statusClasses = {
  ok:   'bg-emerald-500',
  warn: 'bg-amber-500',
  off:  'bg-muted-foreground/70',
};

/**
 * ClayModuleTile — compact, clickable tile surfacing one module's
 * primary metric. Wraps the shadcn `Card` primitive in a `next/link`
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
            className="h-3.5 w-3.5 text-muted-foreground/70 transition-[color,transform] group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            strokeWidth={2}
          />
        </div>

        <div className="mt-3.5 text-xs font-medium text-muted-foreground leading-none">
          {name}
        </div>

        <div className="mt-1.5 flex items-baseline gap-1.5">
          <div className="text-xl font-semibold tracking-[-0.01em] text-foreground leading-none">
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
          <div className="mt-1 text-[11px] text-muted-foreground leading-tight truncate">
            {secondary}
          </div>
        ) : null}
      </Card>
    </Link>
  );
}
