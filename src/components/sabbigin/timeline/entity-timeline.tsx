'use client';

/**
 * SabBigin — reusable entity timeline.
 *
 * Renders a vertical activity feed for a deal / contact / any CRM record.
 * Each item is a small typed event (note, audit, email, whatsapp, task,
 * stage change…) with a tone-coded icon chip, a title, an optional body and
 * a relative timestamp. The shape matches what `getCrmEntityTimeline`
 * returns (`{ id, type, title, body, createdAt, actorName }`) but is loose
 * enough to accept the locally-synthesised entries the detail islands push
 * after a note / stage-change so the feed updates without a round trip.
 */

import * as React from 'react';
import {
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  Mail,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Phone,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { EmptyState } from '@/components/sabcrm/20ui';
import { relativeTime, formatDateTime } from '@/components/sabbigin/lib/format';

export interface TimelineItem {
  id: string;
  /** Event class — drives the icon + tint. */
  type?: string | null;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** ISO string (preferred) or anything `Date` can parse. */
  timestamp?: string | Date | null;
  /** Alias accepted from `getCrmEntityTimeline` results. */
  createdAt?: string | Date | null;
  actorName?: string | null;
}

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  comment: StickyNote,
  note: StickyNote,
  email: Mail,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  call: Phone,
  task: CheckCircle2,
  stage: ArrowRightLeft,
  stage_change: ArrowRightLeft,
  file: Paperclip,
  audit: Activity,
};

const TINT_BY_TYPE: Record<string, string> = {
  comment: '#a855f7',
  note: '#a855f7',
  email: '#3b7af5',
  whatsapp: '#1f9d55',
  sms: '#1f9d55',
  call: '#0ea5e9',
  task: '#f59e0b',
  stage: '#6366f1',
  stage_change: '#6366f1',
  file: '#64748b',
  audit: '#64748b',
};

function resolveType(t?: string | null): string {
  const key = (t ?? 'audit').toLowerCase();
  return ICON_BY_TYPE[key] ? key : 'audit';
}

export interface EntityTimelineProps {
  items: TimelineItem[];
  /** Copy shown when the feed is empty. */
  emptyTitle?: string;
  emptyDescription?: string;
}

export function EntityTimeline({
  items,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Notes, emails, stage changes and other events will show up here as they happen.',
}: EntityTimelineProps): React.JSX.Element {
  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={emptyTitle}
        description={emptyDescription}
        size="sm"
      />
    );
  }

  return (
    <ol className="relative flex flex-col">
      {items.map((item, idx) => {
        const type = resolveType(item.type);
        const Icon = ICON_BY_TYPE[type];
        const tint = TINT_BY_TYPE[type] ?? '#64748b';
        const when = item.timestamp ?? item.createdAt ?? null;
        const isLast = idx === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* connector rail */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-7 bottom-0 w-px bg-[var(--st-border)]"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="relative z-[1] mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg)]"
              style={{ color: tint }}
            >
              <Icon size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-[var(--st-text)]">
                  {item.title}
                </p>
                <time
                  className="shrink-0 text-[11px] text-[var(--st-text-tertiary)]"
                  title={when ? formatDateTime(when) : undefined}
                  dateTime={
                    when
                      ? when instanceof Date
                        ? when.toISOString()
                        : String(when)
                      : undefined
                  }
                >
                  {when ? relativeTime(when) : ''}
                </time>
              </div>
              {item.body ? (
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--st-text-secondary)]">
                  {item.body}
                </p>
              ) : null}
              {item.actorName ? (
                <p className="mt-1 text-[11px] text-[var(--st-text-tertiary)]">
                  {item.actorName}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default EntityTimeline;
