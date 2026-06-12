'use client';

/**
 * RecordTabs — the right tab area of the RecordSurface detail page
 * (composites/record) + the {@link TimelineList} building block.
 *
 * Fully pluggable: the caller hands in `tabs` ({ id, label, icon?, badge?,
 * content }) and this component renders a 20ui `Tabs` strip with the matching
 * panels. A tab's content mounts lazily on first open and then stays mounted
 * (hidden) so flipping back is instant and tab-local state survives.
 *
 * `TimelineList` renders a clean vertical activity timeline — icon-per-kind
 * rail, title, optional meta line, actor chip and a relative timestamp (or a
 * caller-supplied formatter). It's the canonical body for the Timeline tab and
 * later hosts WhatsApp / email entries as more `kind`s.
 *
 * Gotchas honoured: 20ui primitives are imported RELATIVELY (never the
 * barrel — self-cycle), icons render via `renderIcon`, tokens only (see
 * record-detail.css).
 */

import * as React from 'react';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Mail,
  Phone,
  Settings2,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';

import { Avatar } from '../../avatar';
import { Tabs, TabPanel, type TabItem } from '../../tabs';
import { renderIcon, type IconProp } from '../../_icon';
import { cn } from '../lib/cn';

import './record-detail.css';

/* ----------------------------------------------------------------- types */

/** One pluggable tab of the record detail surface. */
export interface RecordDetailTab {
  id: string;
  label: string;
  icon?: IconProp;
  /** Trailing count/status badge (e.g. a number). */
  badge?: React.ReactNode;
  content: React.ReactNode;
}

export interface RecordTabsProps {
  tabs: RecordDetailTab[];
  /** The initially-active tab (uncontrolled). Defaults to the first tab. */
  defaultTabId?: string;
  /** Notified after the active tab changes. */
  onTabChange?: (id: string) => void;
  className?: string;
}

/* ------------------------------------------------------------- component */

export function RecordTabs({
  tabs,
  defaultTabId,
  onTabChange,
  className,
}: RecordTabsProps): React.JSX.Element {
  const [active, setActive] = React.useState<string>(
    () => defaultTabId ?? tabs[0]?.id ?? '',
  );
  /** Tabs that have been opened at least once — their content stays mounted. */
  const [opened, setOpened] = React.useState<ReadonlySet<string>>(
    () => new Set(active ? [active] : []),
  );

  // If the active tab disappears (pluggable tabs may change), fall back.
  const effective = tabs.some((t) => t.id === active) ? active : tabs[0]?.id ?? '';

  const select = React.useCallback(
    (id: string) => {
      setActive(id);
      setOpened((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      onTabChange?.(id);
    },
    [onTabChange],
  );

  const items = React.useMemo<TabItem[]>(
    () =>
      tabs.map((t) => ({
        value: t.id,
        label: t.label,
        icon: t.icon,
        badge: t.badge,
      })),
    [tabs],
  );

  if (tabs.length === 0) {
    return (
      <div className={cn('rd-tabs', className)}>
        <div className="rd-empty">
          <span className="rd-empty__icon" aria-hidden="true">
            <Inbox size={18} />
          </span>
          <span className="rd-empty__title">Nothing to show</span>
          <span className="rd-empty__hint">No sections are configured for this record.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rd-tabs', className)}>
      <Tabs
        items={items}
        value={effective}
        onChange={select}
        className="rd-tabs__strip"
        aria-label="Record sections"
      >
        {tabs.map((t) =>
          opened.has(t.id) || t.id === effective ? (
            <TabPanel
              key={t.id}
              value={t.id}
              keepMounted
              className="rd-tabs__panel"
            >
              {t.content}
            </TabPanel>
          ) : null,
        )}
      </Tabs>
    </div>
  );
}

/* =========================================================================
   TimelineList — the Timeline tab's building block
   ========================================================================= */

export type TimelineItemKind =
  | 'note'
  | 'task'
  | 'call'
  | 'email'
  | 'meeting'
  | 'event'
  | 'system';

export interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  title: React.ReactNode;
  /** Secondary line under the title (body excerpt, status chip, …). */
  meta?: React.ReactNode;
  at: string | Date;
  actor?: { name: string; avatarUrl?: string };
  /**
   * Right-aligned row actions (e.g. an edit/delete menu). Always in the tab
   * order; only VISUALLY revealed on row hover / focus-within (see
   * `.rd-timeline__actions` in record-detail.css).
   */
  actions?: React.ReactNode;
}

export interface TimelineListProps {
  items: TimelineItem[];
  /** Timestamp formatter. Defaults to a compact relative time. */
  fmt?: (at: Date) => string;
  /** Rendered when `items` is empty. */
  emptyState?: React.ReactNode;
  className?: string;
}

const KIND_ICON: Record<TimelineItemKind, LucideIcon> = {
  note: StickyNote,
  task: CheckCircle2,
  call: Phone,
  email: Mail,
  meeting: CalendarClock,
  event: Sparkles,
  system: Settings2,
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time — "just now", "5m ago", "3h ago", "2d ago", else date. */
function relTime(then: Date): string {
  const diff = Date.now() - then.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return then.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDate(at: string | Date): Date | null {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function TimelineList({
  items,
  fmt,
  emptyState,
  className,
}: TimelineListProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <div className={cn('rd-timeline', className)}>
        {emptyState ?? (
          <div className="rd-empty">
            <span className="rd-empty__icon" aria-hidden="true">
              <Activity size={18} />
            </span>
            <span className="rd-empty__title">No activity yet</span>
            <span className="rd-empty__hint">
              Notes, tasks and events on this record will appear here.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <ol className={cn('rd-timeline', className)}>
      {items.map((item) => {
        const date = toDate(item.at);
        const stamp = date ? (fmt ? fmt(date) : relTime(date)) : '';
        return (
          <li className="rd-timeline__item" key={item.id} data-kind={item.kind}>
            <span className="rd-timeline__dot" aria-hidden="true">
              {renderIcon(KIND_ICON[item.kind] ?? Activity, { size: 12 })}
            </span>
            <div className="rd-timeline__content">
              <div className="rd-timeline__head">
                <span className="rd-timeline__title">{item.title}</span>
                {date ? (
                  <time
                    className="rd-timeline__time"
                    dateTime={date.toISOString()}
                    title={date.toLocaleString()}
                  >
                    {stamp}
                  </time>
                ) : null}
                {item.actions != null ? (
                  <span className="rd-timeline__actions">{item.actions}</span>
                ) : null}
              </div>
              {item.meta != null ? (
                <div className="rd-timeline__meta">{item.meta}</div>
              ) : null}
              {item.actor ? (
                <span className="rd-timeline__actor">
                  <Avatar
                    name={item.actor.name}
                    src={item.actor.avatarUrl}
                    size="xs"
                    shape="round"
                  />
                  {item.actor.name}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default RecordTabs;
