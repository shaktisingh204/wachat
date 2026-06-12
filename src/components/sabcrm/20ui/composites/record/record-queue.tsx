'use client';

/**
 * RecordQueue — the `queue` presentation of a saved view (RecordSurface
 * composite, 20ui): a prioritized to-work list.
 *
 * The view's filters scope the queue and its multi-sort is the priority
 * order, so this component does NO fetching or sorting of its own — the host
 * passes `records` already filtered + sorted (the table fetch path) and the
 * per-user work `states` (collection `sabcrm_view_queue_state`, via
 * `listQueueStateTw`). Records partition into:
 *
 *   - **Up next** — no work state (or an expired snooze) and the view's
 *     `doneWhen` rule does not match; rendered in priority order, the first
 *     row highlighted as "Next up".
 *   - **Snoozed** — `snoozedUntil > now`. Collapsible, with Undo.
 *   - **Done** — `doneAt` set OR the `doneWhen` leaf matches the record's
 *     data. Collapsible, with Undo (state-marked rows only — rule-matched
 *     rows are inherently done).
 *
 * Work-state actions are per-user and non-destructive: Done / Snooze / Undo
 * all flow out through `onMark` (the host calls `markQueueItemTw` and updates
 * `states` optimistically). Opening a record flows through `onOpen`.
 *
 * The `doneWhen` leaf is evaluated with the SAME operator semantics as the
 * adapter's `recordMatchesFilters` (`record-surface-adapter.ts`) — duplicated
 * locally because composites never import from `@/app` (layering).
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel —
 * self-cycle), styling rides `--st-*` tokens (see record-queue.css) so dark
 * mode is free.
 */

import * as React from 'react';
import {
  AlarmClock,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Inbox,
  Undo2,
} from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { Button, IconButton } from '../../button';
import { Badge } from '../../badge';
import { Spinner } from '../../loading';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../dropdown';
import { cn } from '../lib/cn';
import { RecordCell } from './record-cell';
import type { FilterCondition } from './filter-builder';
import type { RelationResolver } from './fields';

import './record-queue.css';

/* ------------------------------------------------------------------ types */

/** One per-user work-state row, keyed by record (from `listQueueStateTw`). */
export interface QueueItemState {
  recordId: string;
  /** RFC3339 — snoozed until this instant (expired snoozes count as up next). */
  snoozedUntil?: string | null;
  /** RFC3339 — marked done at this instant. */
  doneAt?: string | null;
}

export interface RecordQueueProps {
  /** Drives labels / accessible names. */
  object: ObjectMetadata;
  /** Already filtered+sorted by the host fetch — order IS the priority. */
  records: CrmRecord[];
  /** Visible columns (inTable) feeding the per-row field chips (first 3). */
  fields: FieldMetadata[];
  /** Per-user work state rows (from `listQueueStateTw`). */
  states: QueueItemState[];
  /** `view.queue.doneWhen` mapped to the client leaf — inherent done rule. */
  doneWhen?: FilterCondition | null;
  /** DATE/DATE_TIME field key driving the SLA chip (overdue when < now). */
  slaFieldKey?: string | null;
  /** Default snooze, minutes (`view.queue.snoozeMinutes`). */
  snoozeMinutes?: number | null;
  loading?: boolean;
  onOpen: (recordId: string) => void;
  onMark: (
    recordId: string,
    action: 'done' | 'snooze' | 'clear',
    until?: string,
  ) => void;
  /** Row title (hosts pass `sabcrmRecordLabel`); falls back to label keys. */
  rowLabel?: (record: CrmRecord) => string;
  relationResolver?: RelationResolver;
  emptyState?: React.ReactNode;
  className?: string;
}

/* --------------------------------------------------------------- matching */

/** Whether a raw cell value is "empty" for the unary operators. */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Evaluate the `doneWhen` leaf against a record's raw cell value — the same
 * operator semantics as the adapter's `recordMatchesFilters` leaf matcher.
 */
function matchLeaf(cell: unknown, c: FilterCondition): boolean {
  switch (c.op) {
    case 'isEmpty':
      return isEmptyValue(cell);
    case 'isNotEmpty':
      return !isEmptyValue(cell);
    default:
      break;
  }

  const raw = c.value ?? '';
  const n = Number(raw);
  const want: string | number = raw.trim() !== '' && !Number.isNaN(n) ? n : raw;

  // Multi-value cells (e.g. MULTI_SELECT) match when any member matches.
  if (Array.isArray(cell)) {
    return cell.some((m) => matchLeaf(m, c));
  }

  if (c.op === 'contains') {
    return String(cell ?? '')
      .toLowerCase()
      .includes(String(want).toLowerCase());
  }

  const cellNum = typeof cell === 'number' ? cell : Number(cell);
  const wantNum = typeof want === 'number' ? want : Number(want);
  const numeric =
    !Number.isNaN(cellNum) &&
    !Number.isNaN(wantNum) &&
    cell !== null &&
    cell !== undefined &&
    String(cell).trim() !== '';

  switch (c.op) {
    case 'eq':
      return numeric ? cellNum === wantNum : String(cell ?? '') === String(want);
    case 'ne':
      return numeric ? cellNum !== wantNum : String(cell ?? '') !== String(want);
    case 'gt':
      return numeric ? cellNum > wantNum : String(cell ?? '') > String(want);
    case 'lt':
      return numeric ? cellNum < wantNum : String(cell ?? '') < String(want);
    case 'gte':
      return numeric ? cellNum >= wantNum : String(cell ?? '') >= String(want);
    case 'lte':
      return numeric ? cellNum <= wantNum : String(cell ?? '') <= String(want);
    default:
      return true;
  }
}

/* ----------------------------------------------------------- date helpers */

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/** Parse an unknown cell into epoch ms, or null when not a date. */
function toEpoch(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Short human date ("Jun 12"), with the year only when it differs. */
function shortDate(ms: number): string {
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

/** Humanize a snooze duration ("1 hour", "3 days", "45 minutes"). */
function humanizeMinutes(minutes: number): string {
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
}

/** Tomorrow at 09:00 local time. */
function tomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

/** Conventional label keys, mirrored from the my-work fallback. */
function fallbackLabel(record: CrmRecord): string {
  for (const key of ['title', 'name', 'label', 'fullName', 'subject', 'email']) {
    const v = record.data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Untitled record';
}

/* ---------------------------------------------------------------- pieces */

function SlaChip({
  record,
  slaFieldKey,
}: {
  record: CrmRecord;
  slaFieldKey: string;
}): React.JSX.Element | null {
  const due = toEpoch(record.data[slaFieldKey]);
  if (due === null) return null;
  const now = Date.now();
  if (due < now) {
    return (
      <Badge tone="danger" className="rq-sla">
        Overdue · {shortDate(due)}
      </Badge>
    );
  }
  if (due - now <= DAY_MS) {
    return (
      <Badge tone="warning" className="rq-sla">
        Due soon · {shortDate(due)}
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" className="rq-sla">
      Due {shortDate(due)}
    </Badge>
  );
}

interface QueueRowProps {
  record: CrmRecord;
  position: number;
  isNext: boolean;
  section: 'next' | 'snoozed' | 'done';
  state: QueueItemState | undefined;
  fields: FieldMetadata[];
  slaFieldKey?: string | null;
  snoozeMinutes?: number | null;
  rowLabel: (record: CrmRecord) => string;
  relationResolver?: RelationResolver;
  onOpen: (recordId: string) => void;
  onMark: RecordQueueProps['onMark'];
}

function QueueRow({
  record,
  position,
  isNext,
  section,
  state,
  fields,
  slaFieldKey,
  snoozeMinutes,
  rowLabel,
  relationResolver,
  onOpen,
  onMark,
}: QueueRowProps): React.JSX.Element {
  const label = rowLabel(record);

  const snooze = (until: Date): void =>
    onMark(record._id, 'snooze', until.toISOString());

  const defaultMinutes =
    typeof snoozeMinutes === 'number' && snoozeMinutes > 0
      ? Math.round(snoozeMinutes)
      : null;

  const snoozedUntil =
    section === 'snoozed' ? toEpoch(state?.snoozedUntil ?? null) : null;

  return (
    <li className={cn('rq-row', isNext && 'rq-row--next')}>
      <span className="rq-row__pos" aria-hidden="true">
        {section === 'next' ? position : '·'}
      </span>

      <span className="rq-row__main">
        <span className="rq-row__title-line">
          {isNext ? (
            <Badge tone="accent" className="rq-next-badge">
              Next up
            </Badge>
          ) : null}
          <button
            type="button"
            className="rq-row__title"
            onClick={() => onOpen(record._id)}
          >
            {label}
          </button>
          {slaFieldKey ? (
            <SlaChip record={record} slaFieldKey={slaFieldKey} />
          ) : null}
          {snoozedUntil !== null ? (
            <span className="rq-row__meta-note">
              until {shortDate(snoozedUntil)}
            </span>
          ) : null}
        </span>

        {fields.length > 0 ? (
          <span className="rq-row__chips">
            {fields.slice(0, 3).map((field) => (
              <span className="rq-chip" key={field.key}>
                <span className="rq-chip__label">{field.label}</span>
                <span className="rq-chip__value">
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

      <span className="rq-row__actions">
        {section === 'next' ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={Check}
              onClick={() => onMark(record._id, 'done')}
            >
              Done
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" iconLeft={AlarmClock}>
                  Snooze
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Snooze until</DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => snooze(new Date(Date.now() + HOUR_MS))}
                >
                  1 hour
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => snooze(tomorrowMorning())}>
                  Tomorrow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => snooze(new Date(Date.now() + 3 * DAY_MS))}
                >
                  3 days
                </DropdownMenuItem>
                {defaultMinutes !== null ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      snooze(new Date(Date.now() + defaultMinutes * 60_000))
                    }
                  >
                    {humanizeMinutes(defaultMinutes)} (view default)
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : state ? (
          <Button
            size="sm"
            variant="ghost"
            iconLeft={Undo2}
            onClick={() => onMark(record._id, 'clear')}
          >
            Undo
          </Button>
        ) : null}
        <IconButton
          label={`Open ${label}`}
          icon={ExternalLink}
          size="sm"
          onClick={() => onOpen(record._id)}
        />
      </span>
    </li>
  );
}

/* ------------------------------------------------------------ RecordQueue */

export function RecordQueue({
  object,
  records,
  fields,
  states,
  doneWhen,
  slaFieldKey,
  snoozeMinutes,
  loading = false,
  onOpen,
  onMark,
  rowLabel,
  relationResolver,
  emptyState,
  className,
}: RecordQueueProps): React.JSX.Element {
  const [snoozedOpen, setSnoozedOpen] = React.useState(false);
  const [doneOpen, setDoneOpen] = React.useState(false);

  const labelOf = rowLabel ?? fallbackLabel;

  // Partition in incoming order — the host's sort IS the priority.
  const { upNext, snoozed, done } = React.useMemo(() => {
    const byId = new Map(states.map((s) => [s.recordId, s]));
    const now = Date.now();
    const upNext: CrmRecord[] = [];
    const snoozed: CrmRecord[] = [];
    const done: CrmRecord[] = [];
    for (const record of records) {
      const state = byId.get(record._id);
      const doneByRule = doneWhen
        ? matchLeaf(record.data[doneWhen.fieldKey], doneWhen)
        : false;
      if (state?.doneAt || doneByRule) {
        done.push(record);
        continue;
      }
      const until = toEpoch(state?.snoozedUntil ?? null);
      if (until !== null && until > now) {
        snoozed.push(record);
        continue;
      }
      upNext.push(record); // expired snoozes count as up next
    }
    return { upNext, snoozed, done };
  }, [records, states, doneWhen]);

  const stateById = React.useMemo(
    () => new Map(states.map((s) => [s.recordId, s])),
    [states],
  );

  if (loading && records.length === 0) {
    return (
      <div className={cn('rq', className)}>
        <div className="rq-loading">
          <Spinner aria-label={`Loading ${object.labelPlural.toLowerCase()}`} />
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className={cn('rq', className)}>
        {emptyState ?? (
          <div className="rq-empty">
            <Inbox size={16} aria-hidden="true" />
            <span>
              No {object.labelPlural.toLowerCase()} in this queue. Adjust the
              view&apos;s filters to scope it.
            </span>
          </div>
        )}
      </div>
    );
  }

  const noun = object.labelPlural.toLowerCase();

  const renderSection = (
    title: string,
    list: CrmRecord[],
    section: 'snoozed' | 'done',
    open: boolean,
    toggle: () => void,
  ): React.JSX.Element | null => {
    if (list.length === 0) return null;
    return (
      <section className="rq-section" aria-label={`${title} ${noun}`}>
        <button
          type="button"
          className="rq-section__head"
          aria-expanded={open}
          onClick={toggle}
        >
          {open ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
          <span className="rq-section__title">{title}</span>
          <span className="rq-section__count">{list.length}</span>
        </button>
        {open ? (
          <ol className="rq-list">
            {list.map((record, i) => (
              <QueueRow
                key={record._id}
                record={record}
                position={i + 1}
                isNext={false}
                section={section}
                state={stateById.get(record._id)}
                fields={fields}
                slaFieldKey={slaFieldKey}
                snoozeMinutes={snoozeMinutes}
                rowLabel={labelOf}
                relationResolver={relationResolver}
                onOpen={onOpen}
                onMark={onMark}
              />
            ))}
          </ol>
        ) : null}
      </section>
    );
  };

  return (
    <div className={cn('rq', className)}>
      <p className="rq-summary" role="status">
        {upNext.length} up next · {snoozed.length} snoozed · {done.length} done
      </p>

      <section className="rq-section" aria-label={`Up next ${noun}`}>
        {upNext.length === 0 ? (
          <div className="rq-empty rq-empty--clear">
            <Check size={16} aria-hidden="true" />
            <span>All clear — nothing up next in this queue.</span>
          </div>
        ) : (
          <ol className="rq-list">
            {upNext.map((record, i) => (
              <QueueRow
                key={record._id}
                record={record}
                position={i + 1}
                isNext={i === 0}
                section="next"
                state={stateById.get(record._id)}
                fields={fields}
                slaFieldKey={slaFieldKey}
                snoozeMinutes={snoozeMinutes}
                rowLabel={labelOf}
                relationResolver={relationResolver}
                onOpen={onOpen}
                onMark={onMark}
              />
            ))}
          </ol>
        )}
      </section>

      {renderSection('Snoozed', snoozed, 'snoozed', snoozedOpen, () =>
        setSnoozedOpen((v) => !v),
      )}
      {renderSection('Done', done, 'done', doneOpen, () =>
        setDoneOpen((v) => !v),
      )}
    </div>
  );
}

export default RecordQueue;
