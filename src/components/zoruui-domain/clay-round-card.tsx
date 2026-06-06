'use client';

import { Card, Button } from '@/components/sabcrm/20ui/compat';
import { LuCalendar, LuUsers } from 'react-icons/lu';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { } from './clay-button';
import { ClayAvatarStack, type ClayAvatarStackItem } from './clay-avatar-stack';

export type RoundStatus = 'completed' | 'in-progress' | 'draft';

export interface ClayRoundCardProps {
  title: string;
  subtitle?: string;
  dateRange: string;
  candidateCount: number;
  status: RoundStatus;
  candidates: ClayAvatarStackItem[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

const statusTone: Record<
  RoundStatus,
  { dot: string; label: string; text: string }
> = {
  completed: {
    dot: 'bg-zoru-ink',
    label: 'Completed',
    text: 'text-zoru-ink-muted',
  },
  'in-progress': {
    dot: 'bg-zoru-ink',
    label: 'In progress',
    text: 'text-zoru-ink-muted',
  },
  draft: {
    dot: 'bg-zoru-surface-2-foreground/70',
    label: 'Draft',
    text: 'text-zoru-ink-muted',
  },
};

/**
 * ClayRoundCard — round summary card built on top of the shadcn
 * `ZoruCard` primitive. Adds a meta row (date / candidate count / status),
 * the title block, and a footer that pairs the avatar stack with a
 * dark CTA button.
 */
export function ClayRoundCard({
  title,
  subtitle,
  dateRange,
  candidateCount,
  status,
  candidates,
  ctaLabel = 'View candidates',
  onCtaClick,
  className,
}: ClayRoundCardProps) {
  const tone = statusTone[status];

  return (
    <Card
      variant="default"
      className={cn('rounded-[14px] p-4 min-w-[260px]', className)}
    >
      {/* meta row — subtle bullet-separated inline group */}
      <div className="flex items-center gap-2.5 text-[11px] text-zoru-ink-muted whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <LuCalendar className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {dateRange}
        </span>
        <span aria-hidden className="text-zoru-ink-muted/70">·</span>
        <span className="inline-flex items-center gap-1">
          <LuUsers className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {candidateCount} candidates
        </span>
        <span aria-hidden className="text-zoru-ink-muted/70">·</span>
        <span className={cn('inline-flex items-center gap-1', tone.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          {tone.label}
        </span>
      </div>

      {/* title block */}
      <div className="mt-2.5">
        <h3 className="text-lg font-semibold tracking-[-0.01em] text-zoru-ink leading-[1.1]">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zoru-ink-muted leading-tight">
            {subtitle}
          </p>
        ) : null}
      </div>

      {/* footer: avatars left, CTA right */}
      <div className="mt-3.5 flex items-center justify-between gap-3">
        <ClayAvatarStack
          items={candidates}
          max={4}
          size="md"
          overflowTone="rose"
        />
        <Button
          variant="obsidian"
          size="sm"
          onClick={onCtaClick}
          trailing={<span aria-hidden className="ml-0.5">→</span>}
        >
          {ctaLabel}
        </Button>
      </div>
    </Card>
  );
}
