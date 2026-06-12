'use client';

/**
 * RecordSurface fields — DATE / DATE_TIME.
 *
 * Display: locale-formatted via the resolved formatters.
 * Edit: the 20ui DatePicker (single mode); DATE_TIME adds a native time
 * input next to the calendar. Picking a date commits (pick = commit);
 * DATE commits a local `yyyy-mm-dd`, DATE_TIME a full ISO string.
 */

import * as React from 'react';

import { DatePicker } from '../../../datepicker';
import { Input } from '../../../field';
import {
  EmptyValue,
  isEmpty,
  toDate,
  type FieldDisplayProps,
  type FieldEditorProps,
} from './shared';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local calendar date as `yyyy-mm-dd` (no TZ shifting via toISOString). */
function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function DateDisplay({ value, fmt }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const out = fmt.date(value);
  return <span className="rc-date">{out || String(value)}</span>;
}

export function DateTimeDisplay({ value, fmt }: FieldDisplayProps): React.JSX.Element {
  if (isEmpty(value)) return <EmptyValue />;
  const out = fmt.dateTime(value);
  return <span className="rc-date">{out || String(value)}</span>;
}

export function DateEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const current = toDate(value) ?? undefined;
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <span
      className="rc-editor-row"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <DatePicker
        ref={ref}
        value={current}
        onChange={(d) => onCommit(d ? toLocalDateString(d) : null)}
        placeholder="Pick a date"
        aria-label={field.label}
      />
    </span>
  );
}

export function DateTimeEditor({
  field,
  value,
  onCommit,
  onCancel,
}: FieldEditorProps): React.JSX.Element {
  const current = toDate(value);
  const [date, setDate] = React.useState<Date | undefined>(current ?? undefined);
  const [time, setTime] = React.useState(
    current ? `${pad2(current.getHours())}:${pad2(current.getMinutes())}` : '',
  );
  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);

  const commit = (d: Date | undefined, t: string): void => {
    if (!d) {
      onCommit(null);
      return;
    }
    const next = new Date(d);
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (m) {
      next.setHours(Number(m[1]), Number(m[2]), 0, 0);
    } else {
      next.setHours(0, 0, 0, 0);
    }
    onCommit(next.toISOString());
  };

  return (
    <span
      className="rc-editor-row"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <DatePicker
        ref={ref}
        value={date}
        onChange={(d) => {
          setDate(d ?? undefined);
          commit(d ?? undefined, time);
        }}
        placeholder="Pick a date"
        aria-label={field.label}
      />
      <Input
        type="time"
        inputSize="sm"
        className="rc-editor-input rc-editor-input--time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        onBlur={() => commit(date, time)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(date, time);
          }
        }}
        aria-label={`${field.label} time`}
      />
    </span>
  );
}
