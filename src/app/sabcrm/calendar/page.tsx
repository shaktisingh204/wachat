'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — Calendar view (`/sabcrm/calendar`), Twenty-faithful.
 *
 * A metadata-driven month calendar that places records on a 7×6 grid by a
 * chosen DATE / DATE_TIME field — e.g. Tasks by due date, Opportunities by
 * close date. Rendered purely in Twenty's visual language: the shared `.st-*`
 * vocabulary from `src/styles/sabcrm-twenty.css` (NOT edited) plus the sibling
 * `./calendar.css` extras and the `@/components/sabcrm/twenty` kit. No ZoruUI /
 * Tailwind / clay; native `Date` only.
 *
 * Controls:
 *   - Object selector — only objects that declare at least one DATE / DATE_TIME
 *     field qualify (the calendar needs a date axis).
 *   - Date-field selector — that object's date fields; the bucketing axis.
 *   - Month navigation — prev / next / "Today".
 *
 * Records are fetched once per (object, project) via
 * `listSabcrmRecordsTw(object, { limit: 200 })` and bucketed CLIENT-side by the
 * chosen field's day, so flipping months / switching the date field is instant
 * and costs no extra round-trips. Each day cell lists its records as small
 * chips linking to `/sabcrm/{object}/{id}`; overflow collapses into a
 * "+N more" toggle.
 *
 * Every data call is a gated server action returning an `ActionResult`. The
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';

import {
  TwentyPageHeader,
  TwentyButton,
  TwentyAvatar,
} from '@/components/sabcrm/twenty';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import '@/styles/sabcrm-twenty.css';
import './calendar.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How many records we pull (and then bucket) per object. */
const RECORD_LIMIT = 200;

/** Max chips a day cell shows before collapsing into "+N more". */
const MAX_PER_DAY = 3;

/** Field types the calendar can place a record on. */
const DATE_TYPES: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['DATE', 'DATE_TIME']);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

// ---------------------------------------------------------------------------
// Date helpers (native Date — no deps)
// ---------------------------------------------------------------------------

/** A local-time day key `YYYY-MM-DD` used to bucket + compare cells. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse a stored date value into a `Date`, or `null` when unset / unparseable.
 * Handles ISO strings, epoch numbers, and bare `YYYY-MM-DD` (which we anchor to
 * local time so it lands on the intended calendar day rather than drifting via
 * UTC).
 */
function parseDateValue(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    // Bare date → local midnight (avoid UTC day-shift).
    const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (bare) {
      return new Date(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3]));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** The label-field value (best-effort) for a record, used as the chip text. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
}

/**
 * Format a parsed date for the selected-day detail panel — shows a time when the
 * source field is a DATE_TIME and the value actually carries one, otherwise the
 * bare day. Mirrors Twenty's calendar card, which surfaces the event time.
 */
function formatFieldDateTime(raw: unknown, isDateTime: boolean): string {
  const d = parseDateValue(raw);
  if (!d) return '';
  if (isDateTime) {
    const hasTime =
      d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
    if (hasTime) {
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Build the 6-week (42-cell) grid for `month` of `year`, starting on Sunday.
 * Each cell carries its `Date`, day key and whether it belongs to the month.
 */
interface DayCell {
  date: Date;
  key: string;
  inMonth: boolean;
}

function buildMonthCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  // Sunday-based offset to the first visible cell.
  const start = new Date(year, month, 1 - first.getDay());
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: d, key: dayKey(d), inMonth: d.getMonth() === month });
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="cal-grid" aria-hidden="true">
      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, r) => (
        <div className="cal-week" key={r}>
          {Array.from({ length: 7 }).map((__, c) => (
            <div className="cal-day" key={c}>
              <div
                className="st-skeleton"
                style={{ height: 16, width: 18, marginBottom: 6 }}
              />
              <div className="st-skeleton" style={{ height: 14 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmCalendarPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  // Object catalogue (filtered to those with a date field).
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loadingObjects, setLoadingObjects] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  // Active selections.
  const [objectSlug, setObjectSlug] = React.useState<string>('');
  const [dateFieldKey, setDateFieldKey] = React.useState<string>('');

  // Visible month (anchored to the 1st).
  const today = React.useMemo(() => new Date(), []);
  const [cursor, setCursor] = React.useState<{ year: number; month: number }>(
    () => ({ year: today.getFullYear(), month: today.getMonth() }),
  );

  // Records for the active object.
  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);

  // Which day cells are "expanded" past the overflow cap (by day key).
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // The day whose records are shown in the detail panel below the grid. Twenty's
  // calendar always has a "selected date" that drives a side/below panel.
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  // ---- Load objects -------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObjects(true);
    setObjectError(null);
    (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObjects([]);
      } else {
        // Only objects with at least one date field can be placed on a calendar.
        const eligible = res.data.filter((o) =>
          o.fields.some((f) => DATE_TYPES.has(f.type)),
        );
        setObjects(eligible);
      }
      setLoadingObjects(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === objectSlug) ?? null,
    [objects, objectSlug],
  );

  const dateFields = React.useMemo<FieldMetadata[]>(
    () =>
      activeObject
        ? activeObject.fields.filter((f) => DATE_TYPES.has(f.type))
        : [],
    [activeObject],
  );

  // Default the object once eligible objects arrive.
  React.useEffect(() => {
    if (!objectSlug && objects.length > 0) {
      setObjectSlug(objects[0].slug);
    }
  }, [objects, objectSlug]);

  // Whenever the object changes, default the date field to its first date field.
  React.useEffect(() => {
    if (dateFields.length === 0) {
      setDateFieldKey('');
      return;
    }
    if (!dateFields.some((f) => f.key === dateFieldKey)) {
      setDateFieldKey(dateFields[0].key);
    }
  }, [dateFields, dateFieldKey]);

  // Expanded-day + selected-day state must not leak across object / field /
  // month changes.
  React.useEffect(() => {
    setExpanded(new Set());
    setSelectedDay(null);
  }, [objectSlug, dateFieldKey, cursor]);

  // ---- Load records for the active object --------------------------------
  React.useEffect(() => {
    if (!objectSlug) {
      setRecords([]);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);
    (async () => {
      const res = await listSabcrmRecordsTw(
        objectSlug,
        { limit: RECORD_LIMIT },
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRecords([]);
      } else {
        setRecords(res.data.records);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  // ---- Bucket records by day key (client-side) ---------------------------
  const buckets = React.useMemo(() => {
    const map = new Map<string, SabcrmRustRecord[]>();
    if (!dateFieldKey) return map;
    for (const rec of records) {
      const d = parseDateValue(rec.data[dateFieldKey]);
      if (!d) continue;
      const key = dayKey(d);
      const list = map.get(key);
      if (list) list.push(rec);
      else map.set(key, [rec]);
    }
    return map;
  }, [records, dateFieldKey]);

  const cells = React.useMemo(
    () => buildMonthCells(cursor.year, cursor.month),
    [cursor],
  );

  const todayKey = React.useMemo(() => dayKey(today), [today]);

  const activeDateField = React.useMemo(
    () => dateFields.find((f) => f.key === dateFieldKey) ?? null,
    [dateFields, dateFieldKey],
  );

  // Records on the currently-selected day (drives the detail panel below grid).
  const selectedRecords = React.useMemo(
    () => (selectedDay ? buckets.get(selectedDay) ?? [] : []),
    [selectedDay, buckets],
  );

  const selectedDayLabel = React.useMemo(() => {
    if (!selectedDay) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedDay);
    if (!m) return selectedDay;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDay]);

  // How many of the loaded records actually fall in the visible month — drives
  // the "no records this month" hint without hiding the grid.
  const visibleCount = React.useMemo(
    () =>
      cells.reduce(
        (sum, c) => (c.inMonth ? sum + (buckets.get(c.key)?.length ?? 0) : sum),
        0,
      ),
    [cells, buckets],
  );

  // ---- Month navigation ---------------------------------------------------
  const goPrev = React.useCallback(() => {
    setCursor((c) => {
      const m = c.month - 1;
      return m < 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: m };
    });
  }, []);

  const goNext = React.useCallback(() => {
    setCursor((c) => {
      const m = c.month + 1;
      return m > 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: m };
    });
  }, []);

  const goToday = React.useCallback(() => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  const toggleExpanded = React.useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ---- Render -------------------------------------------------------------

  const monthTitle = `${MONTHS[cursor.month]} ${cursor.year}`;

  return (
    <div className="st-page">
      <TwentyPageHeader title="Calendar" />

      <div className="cal-controls">
        <div className="cal-controls__group">
          <span className="cal-controls__label">Object</span>
          <select
            className="st-select"
            value={objectSlug}
            disabled={loadingObjects || objects.length === 0}
            onChange={(e) => setObjectSlug(e.target.value)}
            aria-label="Calendar object"
          >
            {objects.length === 0 && <option value="">No objects</option>}
            {objects.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.labelPlural}
              </option>
            ))}
          </select>
        </div>

        <div className="cal-controls__group">
          <span className="cal-controls__label">By date</span>
          <select
            className="st-select"
            value={dateFieldKey}
            disabled={dateFields.length === 0}
            onChange={(e) => setDateFieldKey(e.target.value)}
            aria-label="Calendar date field"
          >
            {dateFields.length === 0 && <option value="">No date field</option>}
            {dateFields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="cal-controls__spacer" />

        <div className="cal-nav">
          <button
            type="button"
            className="cal-nav__btn"
            onClick={goPrev}
            aria-label="Previous month"
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="cal-nav__title">{monthTitle}</span>
          <button
            type="button"
            className="cal-nav__btn"
            onClick={goNext}
            aria-label="Next month"
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <TwentyButton variant="secondary" onClick={goToday}>
            Today
          </TwentyButton>
        </div>
      </div>

      {objectError && <ErrorBanner message={objectError} />}
      {dataError && <ErrorBanner message={dataError} />}

      {loadingObjects ? (
        <GridSkeleton />
      ) : objects.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <CalendarDays size={20} />
          </span>
          <h2 className="st-empty__title">No calendarable objects</h2>
          <p className="st-empty__desc">
            None of your CRM objects has a date field to place records on. Add a
            DATE or DATE&nbsp;TIME field to an object to use the calendar.
          </p>
        </div>
      ) : !activeObject || dateFields.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Pick an object and date field</h2>
          <p className="st-empty__desc">
            Choose an object with a date field above to populate the calendar.
          </p>
        </div>
      ) : loadingData ? (
        <GridSkeleton />
      ) : (
        <>
          <div className="cal-grid" role="grid" aria-label={`${monthTitle} calendar`}>
            <div className="cal-weekdays" role="row">
              {WEEKDAYS.map((w) => (
                <div key={w} className="cal-weekday" role="columnheader">
                  {w}
                </div>
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, week) => (
              <div className="cal-week" key={week} role="row">
                {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                  const dayRecords = buckets.get(cell.key) ?? [];
                  const isExpanded = expanded.has(cell.key);
                  const shown = isExpanded
                    ? dayRecords
                    : dayRecords.slice(0, MAX_PER_DAY);
                  const overflow = dayRecords.length - shown.length;
                  const isToday = cell.key === todayKey;
                  const isSelected = cell.key === selectedDay;
                  return (
                    <div
                      key={cell.key}
                      role="gridcell"
                      tabIndex={0}
                      onClick={() => setSelectedDay(cell.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedDay(cell.key);
                        }
                      }}
                      aria-label={`${cell.date.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}${isToday ? ' (today)' : ''}${
                        dayRecords.length > 0
                          ? `, ${dayRecords.length} ${
                              dayRecords.length === 1 ? 'record' : 'records'
                            }`
                          : ''
                      }`}
                      className={`cal-day${
                        cell.inMonth ? '' : ' cal-day--outside'
                      }${isToday ? ' cal-day--today' : ''}${
                        isSelected ? ' cal-day--selected' : ''
                      }`}
                    >
                      <div className="cal-day__head">
                        <span className="cal-day__num" aria-hidden="true">
                          {cell.date.getDate()}
                        </span>
                      </div>
                      {dayRecords.length > 0 && (
                        <div className="cal-day__items">
                          {shown.map((rec) => {
                            const label = recordLabel(activeObject, rec);
                            return (
                              <Link
                                key={rec.id}
                                href={`/sabcrm/${activeObject.slug}/${rec.id}`}
                                className="cal-event"
                                title={label}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <TwentyAvatar name={label} size="xs" />
                                <span className="cal-event__label">{label}</span>
                              </Link>
                            );
                          })}
                          {overflow > 0 && (
                            <button
                              type="button"
                              className="cal-more"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(cell.key);
                              }}
                            >
                              +{overflow} more
                            </button>
                          )}
                          {isExpanded && dayRecords.length > MAX_PER_DAY && (
                            <button
                              type="button"
                              className="cal-more"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(cell.key);
                              }}
                            >
                              Show less
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedDay && (
            <div className="cal-detail" aria-live="polite">
              <div className="cal-detail__head">
                <CalendarDays size={15} aria-hidden="true" />
                <span className="cal-detail__title">{selectedDayLabel}</span>
                <span className="cal-detail__sub">
                  {selectedRecords.length === 0
                    ? `No ${activeObject.labelPlural.toLowerCase()}`
                    : `${selectedRecords.length} ${
                        selectedRecords.length === 1
                          ? activeObject.labelSingular.toLowerCase()
                          : activeObject.labelPlural.toLowerCase()
                      }`}
                </span>
              </div>
              {selectedRecords.length === 0 ? (
                <div className="cal-detail__empty">
                  Nothing scheduled on this day. Pick another day with records, or
                  add a {activeObject.labelSingular.toLowerCase()} with a{' '}
                  {activeDateField?.label ?? 'date'}.
                </div>
              ) : (
                <ul className="cal-detail__list">
                  {selectedRecords.map((rec) => {
                    const label = recordLabel(activeObject, rec);
                    const when = formatFieldDateTime(
                      rec.data[dateFieldKey],
                      activeDateField?.type === 'DATE_TIME',
                    );
                    return (
                      <li key={rec.id} className="cal-detail__row">
                        <Link
                          href={`/sabcrm/${activeObject.slug}/${rec.id}`}
                          className="cal-detail__link"
                        >
                          <TwentyAvatar name={label} size="sm" />
                          <span className="cal-detail__name" title={label}>
                            {label}
                          </span>
                        </Link>
                        {when && <span className="cal-detail__when">{when}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <p className="cal-note">
            {visibleCount === 0
              ? `No ${activeObject.labelPlural.toLowerCase()} with a ${
                  dateFields.find((f) => f.key === dateFieldKey)?.label ??
                  'date'
                } in ${monthTitle}.`
              : `${visibleCount} ${
                  visibleCount === 1
                    ? activeObject.labelSingular.toLowerCase()
                    : activeObject.labelPlural.toLowerCase()
                } shown${
                  selectedDay ? '' : ' · select a day to see its records'
                } · up to ${RECORD_LIMIT} most-recent records loaded.`}
          </p>
        </>
      )}
    </div>
  );
}
