'use client';

/**
 * SabCRM — Twenty-faithful TIMELINE.
 *
 * `<TwentyTimeline activities />` is a *presentational* vertical activity feed
 * in Twenty's record-page style: a left rail of connected dots, each entry
 * carrying a type icon, a title, an optional body, the relative time and the
 * author. Data wiring (fetching notes / tasks / events) happens elsewhere — this
 * component only paints the items it is handed.
 *
 *   - `loading` → a few shimmering skeleton rows.
 *   - empty (no activities) → a muted empty state (`emptyLabel`).
 *
 * NO Ui20 / Tailwind / clay — Twenty look only (`.st-timeline*` classes in the
 * sibling `twenty-field.css`).
 */

import * as React from 'react';
import {
  StickyNote,
  CheckCircle2,
  Phone,
  CalendarClock,
  Mail,
  Activity,
  type LucideIcon,
} from 'lucide-react';

import './twenty-field.css';

/* =========================================================================
   Types
   ========================================================================= */

/** A single activity entry rendered in the timeline. */
export interface TimelineItem {
  id: string;
  /** Activity category — drives the icon / dot tint. */
  type: string;
  title: string;
  body?: string;
  /** ISO date string (or anything `new Date()` accepts). */
  createdAt: string;
  authorName?: string;
}

export interface TwentyTimelineProps {
  activities: TimelineItem[];
  loading?: boolean;
  emptyLabel?: string;
}

/* =========================================================================
   Helpers
   ========================================================================= */

/** Map a known activity type to a Twenty timeline icon. */
const TYPE_ICON: Record<string, LucideIcon> = {
  NOTE: StickyNote,
  TASK: CheckCircle2,
  CALL: Phone,
  MEETING: CalendarClock,
  EMAIL: Mail,
};

function iconFor(type: string): LucideIcon {
  return TYPE_ICON[type.toUpperCase()] ?? Activity;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time — "just now", "5m", "3h", "2d", else a short date. */
function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* =========================================================================
   Skeleton
   ========================================================================= */

function TimelineSkeleton(): React.JSX.Element {
  return (
    <div className="st-timeline" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div className="st-timeline__item" key={i}>
          <div className="st-timeline__rail">
            <span className="st-timeline__dot st-timeline__dot--skeleton" />
          </div>
          <div className="st-timeline__content">
            <div className="st-timeline__sk st-timeline__sk--title" />
            <div className="st-timeline__sk st-timeline__sk--body" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================================
   TwentyTimeline
   ========================================================================= */

/** Presentational vertical activity timeline in Twenty's style. */
export function TwentyTimeline({
  activities,
  loading = false,
  emptyLabel = 'No activity yet',
}: TwentyTimelineProps): React.JSX.Element {
  if (loading) {
    return <TimelineSkeleton />;
  }

  if (!activities.length) {
    return <div className="st-timeline-empty">{emptyLabel}</div>;
  }

  return (
    <ol className="st-timeline">
      {activities.map((item) => {
        const Icon = iconFor(item.type);
        return (
          <li className="st-timeline__item" key={item.id}>
            <div className="st-timeline__rail">
              <span className="st-timeline__dot" aria-hidden="true">
                <Icon size={12} />
              </span>
            </div>
            <div className="st-timeline__content">
              <div className="st-timeline__head">
                <span className="st-timeline__title">{item.title}</span>
                <time className="st-timeline__time" dateTime={item.createdAt}>
                  {relativeTime(item.createdAt)}
                </time>
              </div>
              {item.body ? (
                <p className="st-timeline__body">{item.body}</p>
              ) : null}
              {item.authorName ? (
                <span className="st-timeline__author">{item.authorName}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default TwentyTimeline;
