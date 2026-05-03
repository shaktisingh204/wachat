'use client';

import * as React from 'react';
import { LuCalendar, LuUsers } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { ClayCard } from './clay-card';
import { ClayButton } from './clay-button';
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
    dot: 'bg-emerald-500',
    label: 'Completed',
    text: 'text-muted-foreground',
  },
  'in-progress': {
    dot: 'bg-amber-500',
    label: 'In progress',
    text: 'text-muted-foreground',
  },
  draft: {
    dot: 'bg-muted-foreground/70',
    label: 'Draft',
    text: 'text-muted-foreground',
  },
};

/**
 * ClayRoundCard — the "Round 1 / Initial Review / avatars / View candidates →"
 * card from the reference.
 *
 * Anatomy (pixel-matched):
 *   ┌───────────────────────────────────────┐
 *   │ 📅 June 12 – June 15  👥 10 cand  • Completed │
 *   │                                               │
 *   │ Round 1                                       │  22px semibold
 *   │ Initial Review                                │  13px muted
 *   │                                               │
 *   │ [●●●●+5]            [ View candidates → ]    │
 *   └───────────────────────────────────────┘
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
    <ClayCard
      variant="default"
      padded={false}
      className={cn('rounded-[14px] p-4 min-w-[260px]', className)}
    >
      {/* meta row — subtle bullet-separated inline group */}
      <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <LuCalendar className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {dateRange}
        </span>
        <span aria-hidden className="text-muted-foreground/70">·</span>
        <span className="inline-flex items-center gap-1">
          <LuUsers className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {candidateCount} candidates
        </span>
        <span aria-hidden className="text-muted-foreground/70">·</span>
        <span className={cn('inline-flex items-center gap-1', tone.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          {tone.label}
        </span>
      </div>

      {/* title block */}
      <div className="mt-2.5">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-foreground leading-[1.1]">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-muted-foreground leading-tight">
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
        <ClayButton
          variant="obsidian"
          size="sm"
          onClick={onCtaClick}
          trailing={<span aria-hidden className="ml-0.5">→</span>}
        >
          {ctaLabel}
        </ClayButton>
      </div>
    </ClayCard>
  );
}
