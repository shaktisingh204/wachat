'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — Calendar view (`/sabcrm/calendar`), 20ui.
 *
 * A metadata-driven month calendar that places records on a month grid by a
 * chosen DATE / DATE_TIME field — e.g. Tasks by due date, Opportunities by
 * close date. Rendered entirely in the 20ui design system: the shared
 * `FullscreenCalendar` composite draws the month grid (header nav, weekday
 * row, day cells, event chips with "+N more" overflow), while the controls,
 * detail panel and states come from the 20ui kit plus the sibling
 * `./calendar.css` page-local layout (`.cal-*`, scoped to the 20ui root).
 * Native `Date` only for the data math.
 *
 * Controls:
 *   - Object selector — only objects that declare at least one DATE / DATE_TIME
 *     field qualify (the calendar needs a date axis).
 *   - Date-field selector — that object's date fields; the bucketing axis.
 *   - Month navigation — prev / next / "Today" (inside the composite header).
 *
 * Records are fetched SERVER-SIDE, scoped to the visible window: each time the
 * object / date field / month changes we query `listSabcrmRecordsTw` with a
 * date-range `filters` group (`<field> >= firstVisibleDay AND <field> <=
 * lastVisibleDay`) covering the 6-week grid, paginating until every matching
 * record in that range is loaded. Only those range-scoped records are bucketed
 * CLIENT-side by the chosen field's day — so large datasets render correctly
 * (no 200-record client cap) while flipping the date field stays instant. Each
 * day cell lists its records as small chips opening `/sabcrm/{object}/{id}`;
 * overflow collapses into a "+N more" affordance that selects the day, whose
 * full record list renders in the detail panel below the grid.
 *
 * Every data call is a gated server action returning an `ActionResult`. The
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Database } from 'lucide-react';

import {
  Alert,
  Avatar,
  EmptyState,
  FullscreenCalendar,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  type CalendarEvent,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRecordFilters,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './calendar.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Per-request page size when paging the server for the visible window. */
const PAGE_SIZE = 200;

/**
 * Safety cap on how many records we'll page in for a single month window. A
 * 6-week grid rarely holds this many dated records; the cap keeps a pathological
 * dataset from looping forever and is surfaced in the footer when hit.
 */
const MAX_WINDOW_RECORDS = 5000;

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
  return sabcrmRecordLabel(object, record);
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

/**
 * The inclusive [start, end) ISO bounds that cover the 6-week (42-cell) grid for
 * `month`/`year`. `startISO` is local midnight of the first visible cell;
 * `endISO` is local midnight of the day AFTER the last visible cell — so a
 * `>= startISO AND < endISO` predicate captures every value on every visible
 * day regardless of whether the stored value carries a time component.
 */
function monthWindowBounds(year: number, month: number): {
  startISO: string;
  endISO: string;
} {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  // 42 cells → the day after the grid is start + 42 days.
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * Build the engine `filters` payload that scopes a query to the visible month
 * window on `fieldKey`. Uses the flat field→condition map form the engine has
 * always accepted (`{ fieldKey: { op, value } }`); two conditions on the same
 * field are ANDed via a nested group so both the lower and upper bound apply.
 */
function windowFilters(
  fieldKey: string,
  startISO: string,
  endISO: string,
): SabcrmRecordFilters {
  return {
    op: 'and',
    conditions: [
      { field: fieldKey, operator: 'gte', value: startISO },
      { field: fieldKey, operator: 'lt', value: endISO },
    ],
  };
}

/**
 * Page the server for EVERY record of `object` matching `filters` (sorted by the
 * date field so the grid fills predictably), up to {@link MAX_WINDOW_RECORDS}.
 * Resolves to either the full record set or the first server error encountered.
 * Pages are 1-based to match the engine's `page` semantics.
 */
async function fetchAllInWindow(
  object: string,
  filters: SabcrmRecordFilters,
  sortBy: string,
  projectId: string | undefined,
): Promise<
  | { ok: true; records: SabcrmRustRecord[]; total: number; capped: boolean }
  | { ok: false; error: string }
> {
  const acc: SabcrmRustRecord[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const res = await listSabcrmRecordsTw(
      object,
      { filters, sortBy, sortDir: 'asc', page, limit: PAGE_SIZE },
      projectId,
    );
    if (!res.ok) return { ok: false, error: res.error };
    total = res.data.total;
    acc.push(...res.data.records);
    const more =
      res.data.records.length === PAGE_SIZE && acc.length < total;
    if (!more || acc.length >= MAX_WINDOW_RECORDS) {
      return {
        ok: true,
        records: acc,
        total,
        capped: acc.length < total,
      };
    }
    page += 1;
  }
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return <Alert tone="danger">{message}</Alert>;
}

function GridSkeleton() {
  return (
    <div className="cal-skel" aria-hidden="true">
      <div className="cal-skel__head">
        {WEEKDAYS.map((w) => (
          <Skeleton key={w} width={30} height={12} radius={6} />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, r) => (
        <div className="cal-skel__row" key={r}>
          {Array.from({ length: 7 }).map((__, c) => (
            <Skeleton key={c} height={84} radius={8} />
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
  const router = useRouter();
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

  // Records for the active object, SCOPED to the visible month window.
  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
  // True when the window held more matching records than we paged in (cap hit).
  const [windowCapped, setWindowCapped] = React.useState(false);

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

  // Selected-day state must not leak across object / field / month changes.
  React.useEffect(() => {
    setSelectedDay(null);
  }, [objectSlug, dateFieldKey, cursor]);

  // ---- Load records for the visible month window (server-side) ------------
  // Re-queried whenever the object, date field, or visible month changes — the
  // server applies the date-range filter so only in-window records cross the
  // wire (no client-side cap). We page until the window is exhausted.
  React.useEffect(() => {
    if (!objectSlug || !dateFieldKey) {
      setRecords([]);
      setWindowCapped(false);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);
    (async () => {
      const { startISO, endISO } = monthWindowBounds(cursor.year, cursor.month);
      const res = await fetchAllInWindow(
        objectSlug,
        windowFilters(dateFieldKey, startISO, endISO),
        dateFieldKey,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRecords([]);
        setWindowCapped(false);
      } else {
        setRecords(res.records);
        setWindowCapped(res.capped);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, dateFieldKey, cursor, activeProjectId]);

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

  // ---- Composite wiring ----------------------------------------------------
  // The 20ui FullscreenCalendar owns the month grid: records become events,
  // the visible month is controlled from `cursor`, clicking a day selects it
  // (detail panel below), and clicking an event chip opens the record page.

  /** Records → calendar events (one chip per record, on its parsed day). */
  const events = React.useMemo<CalendarEvent[]>(() => {
    if (!activeObject || !dateFieldKey) return [];
    const out: CalendarEvent[] = [];
    for (const rec of records) {
      const d = parseDateValue(rec.data[dateFieldKey]);
      if (!d) continue;
      out.push({ id: rec.id, date: d, title: recordLabel(activeObject, rec) });
    }
    return out;
  }, [records, activeObject, dateFieldKey]);

  /** Controlled visible month for the composite (anchored to the 1st). */
  const visibleMonth = React.useMemo(
    () => new Date(cursor.year, cursor.month, 1),
    [cursor],
  );

  const handleMonthChange = React.useCallback((next: Date) => {
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }, []);

  const handleDateClick = React.useCallback((date: Date) => {
    setSelectedDay(dayKey(date));
  }, []);

  const handleEventClick = React.useCallback(
    (event: CalendarEvent) => {
      if (!activeObject) return;
      router.push(`/sabcrm/${activeObject.slug}/${event.id}`);
    },
    [router, activeObject],
  );

  // ---- Render -------------------------------------------------------------

  const monthTitle = `${MONTHS[cursor.month]} ${cursor.year}`;

  return (
    <div className="cal-page">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Calendar</PageTitle>
          <PageDescription>
            Records placed on a month grid by a date field.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <div className="cal-controls">
        <div className="cal-controls__group">
          <span className="cal-controls__label" id="cal-object-label">
            Object
          </span>
          <Select
            value={objectSlug}
            onValueChange={(v) => setObjectSlug(v)}
            disabled={loadingObjects || objects.length === 0}
          >
            <SelectTrigger
              className="cal-controls__select"
              aria-labelledby="cal-object-label"
            >
              <SelectValue
                placeholder={objects.length === 0 ? 'No objects' : 'Select object'}
              />
            </SelectTrigger>
            <SelectContent>
              {objects.map((o) => (
                <SelectItem key={o.slug} value={o.slug}>
                  {o.labelPlural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="cal-controls__group">
          <span className="cal-controls__label" id="cal-field-label">
            By date
          </span>
          <Select
            value={dateFieldKey}
            onValueChange={(v) => setDateFieldKey(v)}
            disabled={dateFields.length === 0}
          >
            <SelectTrigger
              className="cal-controls__select"
              aria-labelledby="cal-field-label"
            >
              <SelectValue
                placeholder={
                  dateFields.length === 0 ? 'No date field' : 'Select date field'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {dateFields.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {objectError && <ErrorBanner message={objectError} />}
      {dataError && <ErrorBanner message={dataError} />}

      {loadingObjects ? (
        <GridSkeleton />
      ) : objects.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No calendarable objects"
          description={
            'None of your CRM objects has a date field to place records on. ' +
            'Add a DATE or DATE TIME field to an object to use the calendar.'
          }
        />
      ) : !activeObject || dateFields.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Pick an object and date field"
          description="Choose an object with a date field above to populate the calendar."
        />
      ) : loadingData ? (
        <GridSkeleton />
      ) : (
        <>
          <FullscreenCalendar
            className="cal-calendar"
            month={visibleMonth}
            onMonthChange={handleMonthChange}
            events={events}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            maxChipsPerDay={MAX_PER_DAY}
          />

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
                          <Avatar name={label} size="sm" />
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
                } · loaded server-side for ${monthTitle}.${
                  windowCapped
                    ? ` Showing the first ${MAX_WINDOW_RECORDS.toLocaleString()} — some records this month are not displayed.`
                    : ''
                }`}
          </p>
        </>
      )}
    </div>
  );
}
