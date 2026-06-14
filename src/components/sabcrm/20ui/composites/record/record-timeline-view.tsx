'use client';

/**
 * RecordTimelineView — the `timeline` presentation of a record list
 * (RecordSurface composite, 20ui).
 *
 * A chronological list of records along a DATE / DATE_TIME field, grouped
 * under relative period headers (Today / Yesterday / This week / This month /
 * a Month-Year bucket). Like the board + queue + calendar presentations it
 * does NO fetching: the host passes `records` already filtered + sorted and
 * the object's field metadata. The timeline picks its driving date field via
 * {@link pickDateField}; when the object has no date field it renders an
 * empty-state and the host degrades to the table view.
 *
 * Pure chronological/period logic lives in `record-view-buckets.ts` (no DOM,
 * unit-tested); this file is the React shell.
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel —
 * self-cycle), styling rides `--st-*` tokens (see record-timeline-view.css).
 */

import * as React from 'react';
import {
  ArrowDownUp,
  ExternalLink,
  GanttChartSquare,
} from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { IconButton, Button } from '../../button';
import { Spinner } from '../../loading';
import { EmptyState } from '../../feedback';
import { cn } from '../lib/cn';
import { RecordCell } from './record-cell';
import type { RelationResolver } from './fields';
import {
  groupTimelinePeriods,
  pickDateField,
  sortChronological,
  type TimelineEntry,
} from './record-view-buckets';

import './record-timeline-view.css';

/* ------------------------------------------------------------------ types */

export interface RecordTimelineViewProps {
  /** Drives labels / accessible names. */
  object: ObjectMetadata;
  /** Already filtered by the host fetch (the timeline re-sorts by its field). */
  records: CrmRecord[];
  /** The object's field metadata (the date field is picked from here). */
  fields: FieldMetadata[];
  /** Visible columns feeding the per-row field chips (first 3). */
  columns?: FieldMetadata[];
  /** Preferred date field key; wins when it is a date field. */
  preferredDateKey?: string | null;
  loading?: boolean;
  onOpen: (recordId: string) => void;
  rowLabel?: (record: CrmRecord) => string;
  relationResolver?: RelationResolver;
  emptyState?: React.ReactNode;
  /** Rendered when the object has no date field. */
  noFieldState?: React.ReactNode;
  className?: string;
}

/** Conventional label keys (mirrors the queue/my-work fallback). */
function fallbackLabel(record: CrmRecord): string {
  for (const key of ['title', 'name', 'label', 'fullName', 'subject', 'email']) {
    const v = record.data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Untitled record';
}

/** Short "Jun 14" / "Jun 14, 2025" + time when the field carries one. */
function formatEntryDate(date: Date, withTime: boolean): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  const day = date.toLocaleDateString(undefined, opts);
  if (!withTime) return day;
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${day} · ${time}`;
}

/* ----------------------------------------------------------- timeline row */

function TimelineRow({
  entry,
  withTime,
  columns,
  labelOf,
  relationResolver,
  onOpen,
}: {
  entry: TimelineEntry;
  withTime: boolean;
  columns: FieldMetadata[];
  labelOf: (record: CrmRecord) => string;
  relationResolver?: RelationResolver;
  onOpen: (recordId: string) => void;
}): React.JSX.Element {
  const { record, date } = entry;
  const label = labelOf(record);
  return (
    <li className="rtl-row">
      <span className="rtl-row__rail" aria-hidden="true">
        <span className="rtl-row__node" />
      </span>
      <span className="rtl-row__when">{formatEntryDate(date, withTime)}</span>
      <span className="rtl-row__main">
        <button
          type="button"
          className="rtl-row__title"
          onClick={() => onOpen(record._id)}
        >
          {label}
        </button>
        {columns.length > 0 ? (
          <span className="rtl-row__chips">
            {columns.slice(0, 3).map((field) => (
              <span className="rtl-chip" key={field.key}>
                <span className="rtl-chip__label">{field.label}</span>
                <span className="rtl-chip__value">
                  <RecordCell
                    field={field}
                    value={record.data[field.key]}
                    record={record}
                    relationResolver={relationResolver}
                  />
                </span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <IconButton
        label={`Open ${label}`}
        icon={ExternalLink}
        size="sm"
        onClick={() => onOpen(record._id)}
      />
    </li>
  );
}

/* -------------------------------------------------------- RecordTimelineView */

export function RecordTimelineView({
  object,
  records,
  fields,
  columns,
  preferredDateKey,
  loading = false,
  onOpen,
  rowLabel,
  relationResolver,
  emptyState,
  noFieldState,
  className,
}: RecordTimelineViewProps): React.JSX.Element {
  const [dir, setDir] = React.useState<'asc' | 'desc'>('desc');

  const dateField = React.useMemo(
    () => pickDateField(fields, preferredDateKey),
    [fields, preferredDateKey],
  );

  const withTime = dateField?.type === 'DATE_TIME';
  const labelOf = rowLabel ?? fallbackLabel;
  // The first 3 visible columns become per-row chips; exclude the date field
  // itself (it already drives the timestamp column).
  const chipColumns = React.useMemo(
    () => (columns ?? []).filter((f) => f.key !== dateField?.key),
    [columns, dateField],
  );

  const { periods, undatedCount } = React.useMemo(() => {
    if (!dateField) return { periods: [], undatedCount: 0 };
    const { entries, undated } = sortChronological(records, dateField.key, dir);
    return {
      periods: groupTimelinePeriods(entries),
      undatedCount: undated.length,
    };
  }, [records, dateField, dir]);

  if (!dateField) {
    return (
      <div className={cn('rtl', className)}>
        {noFieldState ?? (
          <EmptyState
            icon={GanttChartSquare}
            title="No date field for a timeline"
            description={`${object.labelPlural} have no date field, so there is nothing to lay out chronologically. Switch to the table view.`}
          />
        )}
      </div>
    );
  }

  if (loading && records.length === 0) {
    return (
      <div className={cn('rtl', className)}>
        <div className="rtl-loading">
          <Spinner aria-label={`Loading ${object.labelPlural.toLowerCase()}`} />
        </div>
      </div>
    );
  }

  const noneDated = periods.length === 0;

  return (
    <div className={cn('rtl', className)}>
      <div className="rtl-head">
        <span className="rtl-head__meta">
          By {dateField.label}
          {undatedCount > 0 ? ` · ${undatedCount} undated` : ''}
        </span>
        <Button
          size="sm"
          variant="ghost"
          iconLeft={ArrowDownUp}
          onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
        >
          {dir === 'desc' ? 'Newest first' : 'Oldest first'}
        </Button>
      </div>

      {noneDated ? (
        emptyState ?? (
          <EmptyState
            size="sm"
            icon={GanttChartSquare}
            title={`No dated ${object.labelPlural.toLowerCase()}`}
            description={`No ${object.labelPlural.toLowerCase()} have a ${dateField.label.toLowerCase()} to place on the timeline.`}
          />
        )
      ) : (
        <div className="rtl-body">
          {periods.map((period) => (
            <section
              className="rtl-period"
              key={period.key}
              aria-label={period.label}
            >
              <h3 className="rtl-period__head">
                <span className="rtl-period__title">{period.label}</span>
                <span className="rtl-period__count">{period.entries.length}</span>
              </h3>
              <ol className="rtl-list">
                {period.entries.map((entry) => (
                  <TimelineRow
                    key={entry.record._id}
                    entry={entry}
                    withTime={withTime}
                    columns={chipColumns}
                    labelOf={labelOf}
                    relationResolver={relationResolver}
                    onOpen={onOpen}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordTimelineView;
