'use client';

/**
 * SabBigin — Activities orchestrator (client).
 *
 * Holds the view state (list | kanban | calendar) + type filter, the bulk
 * selection bar, and the three view renderers. The server page passes already
 * serialised `SabActivityRow[]` plus the resolved initial `view` / `type` (read
 * from searchParams) and keeps the URL in sync so deep links / the legacy
 * /calls + /emails redirects land on the right view.
 */

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  PhoneCall,
  Mail,
  CheckSquare,
  CalendarClock,
  StickyNote,
  Activity,
  Plus,
  Check,
  Trash2,
  X,
  ListChecks,
  List as ListIcon,
  Columns3,
  Calendar as CalendarIcon,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Card,
  Badge,
  Checkbox,
  EmptyState,
  SegmentedControl,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Avatar,
  FullscreenCalendar,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  toast,
  type BadgeTone,
  type CalendarEvent,
} from '@/components/sabcrm/20ui';

import type { SabActivityRow } from '@/components/sabbigin/lib/types';
import { formatDate, formatDateTime, initials } from '@/components/sabbigin/lib/format';
import {
  bulkCompleteActivities,
  bulkDeleteActivities,
} from '@/app/actions/crm-activity.actions';
import { completeSabbiginActivity } from '@/app/actions/sabbigin-activities.actions';
import { LogActivityModal } from '@/components/sabbigin/activities/log-activity-modal';
import type { SabbiginActivityType } from '@/app/actions/sabbigin-activities.actions';

type ActivitiesView = 'list' | 'kanban' | 'calendar';
type TypeFilter = 'all' | 'call' | 'email' | 'task' | 'meeting';

const VIEW_ITEMS = [
  { value: 'list' as const, label: 'List', icon: ListIcon },
  { value: 'kanban' as const, label: 'Kanban', icon: Columns3 },
  { value: 'calendar' as const, label: 'Calendar', icon: CalendarIcon },
];

const TYPE_FILTER_ITEMS = [
  { value: 'all' as const, label: 'All' },
  { value: 'call' as const, label: 'Calls' },
  { value: 'email' as const, label: 'Emails' },
  { value: 'task' as const, label: 'Tasks' },
  { value: 'meeting' as const, label: 'Meetings' },
];

/** Normalise a row's (possibly lowercase / labelled) type to a display label. */
function typeLabel(row: SabActivityRow): string {
  const raw = String(row.type ?? '').toLowerCase();
  if (raw === 'call') return 'Call';
  if (raw === 'email') return 'Email';
  if (raw === 'meeting') return 'Meeting';
  if (raw === 'note') return 'Note';
  if (raw === 'task') return 'Task';
  // Fallback: capitalise whatever was stored.
  return raw ? raw[0].toUpperCase() + raw.slice(1) : 'Activity';
}

function typeIcon(row: SabActivityRow) {
  switch (String(row.type ?? '').toLowerCase()) {
    case 'call':
      return PhoneCall;
    case 'email':
      return Mail;
    case 'meeting':
      return CalendarClock;
    case 'note':
      return StickyNote;
    case 'task':
      return CheckSquare;
    default:
      return Activity;
  }
}

/** Map an activity status to a Badge tone + label. */
function statusBadge(status?: string | null): { tone: BadgeTone; label: string } {
  const s = (status ?? 'open').toLowerCase();
  if (s === 'completed') return { tone: 'success', label: 'Completed' };
  if (s === 'overdue') return { tone: 'danger', label: 'Overdue' };
  return { tone: 'info', label: 'Open' };
}

/** A row counts as "done" iff its status is completed. */
function isDone(row: SabActivityRow): boolean {
  return (row.status ?? '').toLowerCase() === 'completed';
}

/** Accent colour for a calendar event chip, by status. */
function eventColor(row: SabActivityRow): string {
  const s = (row.status ?? 'open').toLowerCase();
  if (s === 'completed') return '#1f9d55';
  if (s === 'overdue') return '#dc2626';
  return '#3b7af5';
}

export interface ActivitiesClientProps {
  activities: SabActivityRow[];
  initialView: ActivitiesView;
  initialType: TypeFilter;
}

export function ActivitiesClient({
  activities: initialActivities,
  initialView,
  initialType,
}: ActivitiesClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const [activities, setActivities] =
    React.useState<SabActivityRow[]>(initialActivities);
  const [view, setView] = React.useState<ActivitiesView>(initialView);
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>(initialType);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [logOpen, setLogOpen] = React.useState(false);
  const [drawerRow, setDrawerRow] = React.useState<SabActivityRow | null>(null);
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    setActivities(initialActivities);
  }, [initialActivities]);

  // Keep the URL (?view=&type=) in sync without a server round-trip on view
  // toggles — the data is already filtered client-side below.
  const pushUrl = React.useCallback(
    (nextView: ActivitiesView, nextType: TypeFilter) => {
      const params = new URLSearchParams();
      if (nextView !== 'list') params.set('view', nextView);
      if (nextType !== 'all') params.set('type', nextType);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  function changeView(next: ActivitiesView) {
    setView(next);
    pushUrl(next, typeFilter);
  }

  function changeType(next: TypeFilter) {
    setTypeFilter(next);
    setSelected(new Set());
    pushUrl(view, next);
  }

  const filtered = React.useMemo(() => {
    if (typeFilter === 'all') return activities;
    return activities.filter(
      (a) => String(a.type ?? '').toLowerCase() === typeFilter,
    );
  }, [activities, typeFilter]);

  /* ── Selection helpers ──────────────────────────────────────────────── */

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((a) => a._id)));
  }

  /* ── Mutations ──────────────────────────────────────────────────────── */

  function handleBulkComplete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await bulkCompleteActivities(ids);
      if (r.success) {
        setActivities((prev) =>
          prev.map((a) =>
            ids.includes(a._id) ? { ...a, status: 'completed' } : a,
          ),
        );
        setSelected(new Set());
        toast.success({
          title: 'Marked complete',
          description: `${r.processed} activit${r.processed === 1 ? 'y' : 'ies'} updated.`,
        });
      } else {
        toast.error({ title: 'Error', description: r.error ?? 'Failed to complete.' });
      }
    });
  }

  function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await bulkDeleteActivities(ids);
      if (r.success) {
        setActivities((prev) => prev.filter((a) => !ids.includes(a._id)));
        setSelected(new Set());
        toast.success({
          title: 'Deleted',
          description: `${r.processed} activit${r.processed === 1 ? 'y' : 'ies'} removed.`,
        });
      } else {
        toast.error({ title: 'Error', description: r.error ?? 'Failed to delete.' });
      }
    });
  }

  function handleCompleteOne(id: string) {
    startTransition(async () => {
      const r = await completeSabbiginActivity(id);
      if (r.success) {
        setActivities((prev) =>
          prev.map((a) => (a._id === id ? { ...a, status: 'completed' } : a)),
        );
        toast.success({ title: 'Marked complete' });
      } else {
        toast.error({ title: 'Error', description: r.error ?? 'Failed to complete.' });
      }
    });
  }

  /* ── Derived: default type for the log modal from the active filter ──── */
  const modalDefaultType: SabbiginActivityType =
    typeFilter === 'email'
      ? 'Email'
      : typeFilter === 'task'
        ? 'Task'
        : typeFilter === 'meeting'
          ? 'Meeting'
          : 'Call';

  const allSelected = filtered.length > 0 && selected.size === filtered.length;
  const someSelected = selected.size > 0 && !allSelected;

  /* ── Bulk bar ───────────────────────────────────────────────────────── */
  const bulkBar =
    selected.size > 0 ? (
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          {selected.size} selected
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            iconLeft={Check}
            onClick={handleBulkComplete}
            disabled={isPending}
          >
            Complete
          </Button>
          <Button
            size="sm"
            variant="danger"
            iconLeft={Trash2}
            onClick={handleBulkDelete}
            disabled={isPending}
          >
            Delete
          </Button>
          <IconButton
            size="sm"
            variant="ghost"
            icon={X}
            label="Clear selection"
            onClick={() => setSelected(new Set())}
          />
        </div>
      </Card>
    ) : null;

  return (
    <>
      <LogActivityModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        defaultType={modalDefaultType}
        onLogged={() => router.refresh()}
      />

      <ActivityDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />

      {/* Toolbar: view switch + type filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<ActivitiesView>
          items={VIEW_ITEMS}
          value={view}
          onChange={changeView}
          size="sm"
          aria-label="Activities view"
        />
        <SegmentedControl<TypeFilter>
          items={TYPE_FILTER_ITEMS}
          value={typeFilter}
          onChange={changeType}
          size="sm"
          aria-label="Filter by type"
        />
      </div>

      {bulkBar}

      {filtered.length === 0 ? (
        <Card padding="none" className="flex min-h-[320px] items-center justify-center">
          <EmptyState
            icon={Activity}
            title="No activities yet"
            description={
              typeFilter === 'all'
                ? 'Log your first call, email, task, or meeting to build a timeline of every touch-point.'
                : `No ${typeFilter} activities yet. Log one to get started.`
            }
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setLogOpen(true)}
              >
                Log activity
              </Button>
            }
          />
        </Card>
      ) : view === 'list' ? (
        <ListView
          rows={filtered}
          selected={selected}
          allSelected={allSelected}
          someSelected={someSelected}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          onOpen={setDrawerRow}
        />
      ) : view === 'kanban' ? (
        <KanbanView
          rows={filtered}
          onComplete={handleCompleteOne}
          onOpen={setDrawerRow}
          busy={isPending}
        />
      ) : (
        <CalendarView rows={filtered} onOpen={setDrawerRow} />
      )}
    </>
  );
}

/* ─── List view ───────────────────────────────────────────────────────── */

function ListView({
  rows,
  selected,
  allSelected,
  someSelected,
  onToggleRow,
  onToggleAll,
  onOpen,
}: {
  rows: SabActivityRow[];
  selected: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (row: SabActivityRow) => void;
}): React.JSX.Element {
  return (
    <Card padding="none" className="overflow-hidden">
      <Table density="comfortable" hover>
        <THead>
          <Tr>
            <Th className="w-8">
              <Checkbox
                size="sm"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onToggleAll}
                aria-label="Select all activities"
              />
            </Th>
            <Th>Type</Th>
            <Th>Title</Th>
            <Th>Contact</Th>
            <Th>Due date</Th>
            <Th align="right">Status</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => {
            const Icon = typeIcon(row);
            const status = statusBadge(row.status);
            return (
              <Tr key={row._id} selected={selected.has(row._id)}>
                <Td>
                  <Checkbox
                    size="sm"
                    checked={selected.has(row._id)}
                    onChange={() => onToggleRow(row._id)}
                    aria-label={`Select ${row.title ?? 'activity'}`}
                  />
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-2 text-[var(--st-text-secondary)]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                      {typeLabel(row)}
                    </span>
                  </span>
                </Td>
                <Td className="font-medium text-[var(--st-text)]">
                  <button
                    type="button"
                    className="-mx-1 truncate rounded-[var(--st-radius-sm)] px-1 py-0.5 text-left transition-colors hover:text-[var(--st-accent)]"
                    onClick={() => onOpen(row)}
                  >
                    {row.title || 'Untitled activity'}
                  </button>
                </Td>
                <Td className="text-[var(--st-text-secondary)]">
                  {row.contactName ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar size="xs" name={row.contactName} initials={initials(row.contactName)} />
                      <span className="truncate text-[12.5px]">{row.contactName}</span>
                    </span>
                  ) : (
                    <span className="text-[12px]">—</span>
                  )}
                </Td>
                <Td className="text-[12.5px] tabular-nums text-[var(--st-text-secondary)]">
                  {row.dueDate ? formatDate(row.dueDate) : '—'}
                </Td>
                <Td align="right">
                  <Badge tone={status.tone} dot>
                    {status.label}
                  </Badge>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </Card>
  );
}

/* ─── Kanban view ─────────────────────────────────────────────────────── */

function KanbanView({
  rows,
  onComplete,
  onOpen,
  busy,
}: {
  rows: SabActivityRow[];
  onComplete: (id: string) => void;
  onOpen: (row: SabActivityRow) => void;
  busy: boolean;
}): React.JSX.Element {
  // Two columns: everything not-yet-completed (open + overdue) vs completed.
  const planned = rows.filter((r) => !isDone(r));
  const overdue = planned.filter((r) => (r.status ?? '').toLowerCase() === 'overdue');
  const open = planned.filter((r) => (r.status ?? '').toLowerCase() !== 'overdue');
  const done = rows.filter((r) => isDone(r));

  const columns: Array<{ key: string; title: string; tone: BadgeTone; rows: SabActivityRow[] }> = [
    { key: 'open', title: 'Planned', tone: 'info', rows: open },
    { key: 'overdue', title: 'Overdue', tone: 'danger', rows: overdue },
    { key: 'done', title: 'Completed', tone: 'success', rows: done },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {columns.map((col) => (
        <div
          key={col.key}
          className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--st-text)]">
              <Badge tone={col.tone} dot>
                {col.title}
              </Badge>
            </span>
            <span className="text-[11.5px] font-medium tabular-nums text-[var(--st-text-secondary)]">
              {col.rows.length}
            </span>
          </div>

          {col.rows.length === 0 ? (
            <p className="rounded-[var(--st-radius-sm)] border border-dashed border-[var(--st-border)] px-3 py-6 text-center text-[12px] text-[var(--st-text-secondary)]">
              Nothing here
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {col.rows.map((row) => {
                const Icon = typeIcon(row);
                return (
                  <Card key={row._id} padding="sm" className="flex flex-col gap-2">
                    <button
                      type="button"
                      className="flex items-start gap-2 text-left"
                      onClick={() => onOpen(row)}
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                        <Icon className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--st-text)]">
                          {row.title || 'Untitled activity'}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-[var(--st-text-secondary)]">
                          {typeLabel(row)}
                          {row.dueDate ? ` · ${formatDate(row.dueDate)}` : ''}
                        </span>
                      </span>
                    </button>

                    {row.contactName ? (
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                        <Avatar size="xs" name={row.contactName} initials={initials(row.contactName)} />
                        {row.contactName}
                      </span>
                    ) : null}

                    {!isDone(row) ? (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={Check}
                          onClick={() => onComplete(row._id)}
                          disabled={busy}
                        >
                          Complete
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Calendar view ───────────────────────────────────────────────────── */

function CalendarView({
  rows,
  onOpen,
}: {
  rows: SabActivityRow[];
  onOpen: (row: SabActivityRow) => void;
}): React.JSX.Element {
  // Only datable activities land on the grid; the rest get a footnote.
  const datable = rows.filter((r) => r.dueDate && !Number.isNaN(new Date(r.dueDate).getTime()));
  const undated = rows.length - datable.length;

  const events: CalendarEvent[] = datable.map((r) => ({
    id: r._id,
    date: new Date(r.dueDate as string),
    title: r.title || typeLabel(r),
    color: eventColor(r),
  }));

  const byId = React.useMemo(() => {
    const map = new Map<string, SabActivityRow>();
    for (const r of datable) map.set(r._id, r);
    return map;
  }, [datable]);

  return (
    <div className="flex flex-col gap-3">
      <Card padding="none" className="overflow-hidden">
        <FullscreenCalendar
          events={events}
          onEventClick={(e) => {
            const row = byId.get(e.id);
            if (row) onOpen(row);
          }}
        />
      </Card>
      {undated > 0 ? (
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          {undated} activit{undated === 1 ? 'y has' : 'ies have'} no due date and
          aren&apos;t shown on the calendar. Switch to the list or kanban view to see them.
        </p>
      ) : null}
    </div>
  );
}

/* ─── Detail drawer ───────────────────────────────────────────────────── */

function ActivityDrawer({
  row,
  onClose,
}: {
  row: SabActivityRow | null;
  onClose: () => void;
}): React.JSX.Element | null {
  if (!row) return null;
  const Icon = typeIcon(row);
  const status = statusBadge(row.status);
  const dir = (row.direction ?? '').toLowerCase();

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} side="right">
      <DrawerContent side="right" className="w-full max-w-md">
        <DrawerHeader>
          <DrawerTitle>
            <span className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)]">
                <Icon className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
              </span>
              {row.title || 'Activity'}
            </span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{typeLabel(row)}</Badge>
            <Badge tone={status.tone} dot>
              {status.label}
            </Badge>
            {dir === 'inbound' ? (
              <Badge tone="info">
                <ArrowDownLeft className="h-3 w-3" aria-hidden="true" /> Inbound
              </Badge>
            ) : dir === 'outbound' ? (
              <Badge tone="accent">
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> Outbound
              </Badge>
            ) : null}
          </div>

          <DetailRow label="Due date" value={row.dueDate ? formatDateTime(row.dueDate) : 'No due date'} />
          {row.contactName ? <DetailRow label="Contact" value={row.contactName} /> : null}
          {row.outcome ? <DetailRow label="Outcome" value={row.outcome} /> : null}
          {row.createdAt ? <DetailRow label="Logged" value={formatDateTime(row.createdAt)} /> : null}

          {row.notes ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </span>
              <p className="whitespace-pre-wrap rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-3 py-2 text-[13px] text-[var(--st-text)]">
                {row.notes}
              </p>
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--st-border)] pb-2">
      <span className="text-[12px] text-[var(--st-text-secondary)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[var(--st-text)]">{value}</span>
    </div>
  );
}

export default ActivitiesClient;
