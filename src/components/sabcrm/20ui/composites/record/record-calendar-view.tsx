'use client';

/**
 * RecordCalendarView — the `calendar` presentation of a record list
 * (RecordSurface composite, 20ui).
 *
 * A month grid bucketed by a DATE / DATE_TIME field of the object. Like the
 * board + queue presentations it does NO fetching: the host passes `records`
 * already filtered + sorted (the table fetch path) and the object's field
 * metadata. The calendar picks its driving date field via
 * {@link pickDateField}; when the object has no date field it renders an
 * empty-state and the host degrades to the table view.
 *
 * Pure month-bucketing logic lives in `record-view-buckets.ts` (no DOM, unit-
 * tested); this file is the React shell.
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel —
 * self-cycle), icons via the primitives' own `icon` plumbing, styling rides
 * `--st-*` tokens (see record-calendar-view.css) so dark mode is free.
 */

import * as React from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dot,
} from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { Button, IconButton } from '../../button';
import { Badge } from '../../badge';
import { Spinner } from '../../loading';
import { EmptyState } from '../../feedback';
import { cn } from '../lib/cn';
import {
  buildMonthGrid,
  defaultCalendarMonth,
  pickDateField,
  type MonthCell,
} from './record-view-buckets';

import './record-calendar-view.css';

/* ------------------------------------------------------------------ types */

export interface RecordCalendarViewProps {
  /** Drives labels / accessible names. */
  object: ObjectMetadata;
  /** Already filtered+sorted by the host fetch. */
  records: CrmRecord[];
  /** The object's field metadata (the date field is picked from here). */
  fields: FieldMetadata[];
  /**
   * Preferred date field key (e.g. the active group-by). When it is a date
   * field it wins; otherwise the calendar auto-picks (see `pickDateField`).
   */
  preferredDateKey?: string | null;
  loading?: boolean;
  /** Open a record (host navigates). */
  onOpen: (recordId: string) => void;
  /** Row/cell title (hosts pass `sabcrmRecordLabel`); falls back to keys. */
  rowLabel?: (record: CrmRecord) => string;
  /** Shown when there ARE records but none in the current scope. */
  emptyState?: React.ReactNode;
  /**
   * Rendered (by the host) when the object has no date field, so the host can
   * also flip back to the table view. Defaults to a built-in empty-state.
   */
  noFieldState?: React.ReactNode;
  className?: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_FMT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

/** Conventional label keys (mirrors the queue/my-work fallback). */
function fallbackLabel(record: CrmRecord): string {
  for (const key of ['title', 'name', 'label', 'fullName', 'subject', 'email']) {
    const v = record.data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Untitled record';
}

/* --------------------------------------------------------------- day cell */

/** Max event chips a single cell shows before collapsing to "+N more". */
const MAX_CHIPS = 3;

function DayCell({
  cell,
  labelOf,
  onOpen,
}: {
  cell: MonthCell;
  labelOf: (record: CrmRecord) => string;
  onOpen: (recordId: string) => void;
}): React.JSX.Element {
  const shown = cell.records.slice(0, MAX_CHIPS);
  const overflow = cell.records.length - shown.length;
  return (
    <div
      className={cn(
        'rcal-cell',
        !cell.inMonth && 'rcal-cell--muted',
        cell.isToday && 'rcal-cell--today',
        cell.records.length > 0 && 'rcal-cell--has',
      )}
    >
      <span className="rcal-cell__num" aria-hidden="true">
        {cell.day}
      </span>
      {cell.records.length > 0 ? (
        <ul className="rcal-cell__events">
          {shown.map((record) => (
            <li key={record._id}>
              <button
                type="button"
                className="rcal-event"
                title={labelOf(record)}
                onClick={() => onOpen(record._id)}
              >
                <Dot size={14} aria-hidden="true" className="rcal-event__dot" />
                <span className="rcal-event__label">{labelOf(record)}</span>
              </button>
            </li>
          ))}
          {overflow > 0 ? (
            <li className="rcal-cell__more">+{overflow} more</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------- RecordCalendarView */

export function RecordCalendarView({
  object,
  records,
  fields,
  preferredDateKey,
  loading = false,
  onOpen,
  rowLabel,
  emptyState,
  noFieldState,
  className,
}: RecordCalendarViewProps): React.JSX.Element {
  const dateField = React.useMemo(
    () => pickDateField(fields, preferredDateKey),
    [fields, preferredDateKey],
  );

  // Anchor month state — seeded from the records once the date field is known.
  const [anchor, setAnchor] = React.useState<{ year: number; month: number } | null>(
    null,
  );

  // Re-seed the anchor when the date field changes (or first becomes known).
  // We only seed ONCE per field key so paging months doesn't snap back.
  const seededForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!dateField) {
      seededForRef.current = null;
      setAnchor(null);
      return;
    }
    if (seededForRef.current === dateField.key && anchor) return;
    seededForRef.current = dateField.key;
    setAnchor(defaultCalendarMonth(records, dateField.key));
    // Intentionally omit `records`/`anchor`: re-seeding on every record change
    // would fight the user's month paging. The seed reads the latest records
    // through the closure at the moment the field key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateField]);

  const labelOf = rowLabel ?? fallbackLabel;

  // No date field → the host should degrade to table; we still render a clear
  // empty-state so a direct mount isn't a blank panel.
  if (!dateField) {
    return (
      <div className={cn('rcal', className)}>
        {noFieldState ?? (
          <EmptyState
            icon={CalendarDays}
            title="No date field to lay out"
            description={`${object.labelPlural} have no date field, so there is nothing to place on a calendar. Switch to the table view.`}
          />
        )}
      </div>
    );
  }

  const active = anchor ?? defaultCalendarMonth(records, dateField.key);
  const grid = buildMonthGrid(records, dateField.key, active.year, active.month);
  const monthLabel = new Date(active.year, active.month, 1).toLocaleDateString(
    undefined,
    MONTH_FMT,
  );

  const step = (delta: number): void =>
    setAnchor(() => {
      const base = anchor ?? active;
      const d = new Date(base.year, base.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const goToday = (): void => {
    const now = new Date();
    setAnchor({ year: now.getFullYear(), month: now.getMonth() });
  };

  if (loading && records.length === 0) {
    return (
      <div className={cn('rcal', className)}>
        <div className="rcal-loading">
          <Spinner aria-label={`Loading ${object.labelPlural.toLowerCase()}`} />
        </div>
      </div>
    );
  }

  const noneInScope = records.length === 0;

  return (
    <div className={cn('rcal', className)}>
      <div className="rcal-head">
        <div className="rcal-head__nav">
          <IconButton
            label="Previous month"
            icon={ChevronLeft}
            size="sm"
            onClick={() => step(-1)}
          />
          <h2 className="rcal-head__title">{monthLabel}</h2>
          <IconButton
            label="Next month"
            icon={ChevronRight}
            size="sm"
            onClick={() => step(1)}
          />
          <Button size="sm" variant="ghost" onClick={goToday}>
            Today
          </Button>
        </div>
        <span className="rcal-head__meta">
          {grid.placedInMonth} this month · by {dateField.label}
          {grid.undated.length > 0 ? (
            <Badge tone="neutral" className="rcal-head__undated">
              {grid.undated.length} undated
            </Badge>
          ) : null}
        </span>
      </div>

      {noneInScope && emptyState ? (
        emptyState
      ) : (
        <div
          className="rcal-grid"
          role="grid"
          aria-label={`${object.labelPlural} calendar by ${dateField.label}`}
        >
          <div className="rcal-weekdays" role="row">
            {WEEKDAYS.map((d) => (
              <span key={d} className="rcal-weekday" role="columnheader">
                {d}
              </span>
            ))}
          </div>
          <div className="rcal-weeks">
            {grid.cells.map((cell) => (
              <DayCell
                key={cell.key}
                cell={cell}
                labelOf={labelOf}
                onOpen={onOpen}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordCalendarView;
