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
    dot: 'bg-clay-green',
    label: 'Completed',
    text: 'text-clay-ink-muted',
  },
  'in-progress': {
    dot: 'bg-clay-amber',
    label: 'In progress',
    text: 'text-clay-ink-muted',
  },
  draft: {
    dot: 'bg-clay-ink-fade',
    label: 'Draft',
    text: 'text-clay-ink-muted',
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
      <div className="flex items-center gap-2.5 text-[11px] text-clay-ink-muted whitespace-nowrap">
        <span className="inline-flex items-center gap-1">
          <LuCalendar className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {dateRange}
        </span>
        <span aria-hidden className="text-clay-ink-fade">·</span>
        <span className="inline-flex items-center gap-1">
          <LuUsers className="h-3 w-3 opacity-75" strokeWidth={1.75} />
          {candidateCount} candidates
        </span>
        <span aria-hidden className="text-clay-ink-fade">·</span>
        <span className={cn('inline-flex items-center gap-1', tone.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          {tone.label}
        </span>
      </div>

      {/* title block */}
      <div className="mt-2.5">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-clay-ink leading-[1.1]">
          {title}
        </h3>
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-clay-ink-muted leading-tight">
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
