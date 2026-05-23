'use client';

/**
 * <ActivityPageClient> — full-featured activity page client shell.
 *
 * Tabs: Feed view (timeline) | Table view (sortable rows)
 *
 * Features:
 *  - KPI strip (activities today, open, overdue, completed this week)
 *  - Filter row: type (call/email/meeting/task/note), status
 *    (open/completed/overdue), assigned user, date range
 *  - Feed view: grouped by date bucket, avatar + verb + entity link + timestamp
 *  - Table view: Type icon, Subject, Related to, Assigned, Due date, Status
 *  - Bulk complete / bulk delete
 *  - Export CSV
 *  - Load more (feed cursor)
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Layers,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ActivityRow } from './activity-row';

import {
  getCrmActivityFeed,
  listCrmActivities,
  bulkCompleteActivities,
  bulkDeleteActivities,
  type CrmActivityFeedResult,
  type CrmActivityRow,
  type CrmActivityDoc,
  type CrmActivityPageKpis,
  type CrmActivityType,
  type CrmActivityStatus,
} from '@/app/actions/crm-activity.actions';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ── type icon map ───────────────────────────────────────────────────────── */

function ActivityTypeIcon({ type }: { type: string }): React.JSX.Element {
  switch (type) {
    case 'call':
      return <Phone className="h-3.5 w-3.5 text-zoru-ink-muted" />;
    case 'email':
      return <Mail className="h-3.5 w-3.5 text-zoru-ink-muted" />;
    case 'meeting':
      return <Users className="h-3.5 w-3.5 text-zoru-ink-muted" />;
    case 'task':
      return <ClipboardList className="h-3.5 w-3.5 text-zoru-ink-muted" />;
    case 'note':
      return <MessageSquare className="h-3.5 w-3.5 text-zoru-ink-muted" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-zoru-ink-muted" />;
  }
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  if (status === 'completed')
    return (
      <Badge variant="success" className="text-[11px]">
        Completed
      </Badge>
    );
  if (status === 'overdue')
    return (
      <Badge variant="danger" className="text-[11px]">
        Overdue
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-[11px]">
      Open
    </Badge>
  );
}

/* ── date bucketing (for feed view) ─────────────────────────────────────── */

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type Bucket = 'Today' | 'Yesterday' | 'This week' | 'Earlier';
const BUCKETS_ORDER: Bucket[] = ['Today', 'Yesterday', 'This week', 'Earlier'];

function bucketFor(ts: number): Bucket {
  const today = startOfDay(Date.now());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 6 * 24 * 60 * 60 * 1000;
  if (ts >= today) return 'Today';
  if (ts >= yesterday) return 'Yesterday';
  if (ts >= weekStart) return 'This week';
  return 'Earlier';
}

/* ── props ───────────────────────────────────────────────────────────────── */

export interface ActivityPageClientProps {
  initialFeed: CrmActivityFeedResult;
  currentUserId?: string;
  initialFilters: {
    entityKind: string;
    actorId: string;
    from: string;
    to: string;
  };
  kpis: CrmActivityPageKpis;
  initialActivities: { items: CrmActivityDoc[]; total: number; page: number; pageSize: number };
}

/* ── component ───────────────────────────────────────────────────────────── */

export function ActivityPageClient({
  initialFeed,
  currentUserId,
  initialFilters,
  kpis,
  initialActivities,
}: ActivityPageClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useZoruToast();

  /* ── feed state ──────────────────────────────────────────────────────── */
  const [filters, setFilters] = React.useState(initialFilters);
  const [feedRows, setFeedRows] = React.useState<CrmActivityRow[]>(initialFeed.items);
  const [cursor, setCursor] = React.useState<string | null>(initialFeed.nextCursor);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const observerTarget = React.useRef<HTMLDivElement>(null);

  /* ── table state ──────────────────────────────────────────────────────── */
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [activities, setActivities] = React.useState<CrmActivityDoc[]>(
    initialActivities.items,
  );
  const [activitiesTotal, setActivitiesTotal] = React.useState(initialActivities.total);
  const [activitiesPage, setActivitiesPage] = React.useState(initialActivities.page);
  const [loadingTable, setLoadingTable] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = React.useState(false);

  // Re-sync feed when server re-renders.
  React.useEffect(() => {
    setFeedRows(initialFeed.items);
    setCursor(initialFeed.nextCursor);
  }, [initialFeed]);

  const handleLoadMore = React.useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getCrmActivityFeed({
        entityKind: filters.entityKind || undefined,
        actorId: filters.actorId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        cursor,
        limit: 50,
      });
      if (!next.error) {
        setFeedRows((prev) => [...prev, ...next.items]);
        setCursor(next.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, filters]);

  React.useEffect(() => {
    const target = observerTarget.current;
    if (!target || !cursor || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [handleLoadMore, loadingMore, cursor]);

  /* ── feed: apply URL filters ──────────────────────────────────────────── */

  const applyFeedFilters = React.useCallback(() => {
    const sp = new URLSearchParams();
    if (filters.entityKind) sp.set('entityKind', filters.entityKind);
    if (filters.actorId) sp.set('actorId', filters.actorId);
    if (filters.from) sp.set('from', filters.from);
    if (filters.to) sp.set('to', filters.to);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [filters, pathname, router]);

  const clearFeedFilters = React.useCallback(() => {
    setFilters({ entityKind: '', actorId: '', from: '', to: '' });
    router.push(pathname);
  }, [pathname, router]);

  /* ── table: load ──────────────────────────────────────────────────────── */

  const loadActivities = React.useCallback(
    async (page = 1) => {
      setLoadingTable(true);
      try {
        const result = await listCrmActivities({
          type: typeFilter === 'all' ? undefined : (typeFilter as CrmActivityType),
          status: statusFilter === 'all' ? undefined : (statusFilter as CrmActivityStatus),
          from: dateFrom || undefined,
          to: dateTo || undefined,
          page,
          pageSize: 50,
        });
        setActivities(result.items);
        setActivitiesTotal(result.total);
        setActivitiesPage(result.page);
        setSelected(new Set());
      } finally {
        setLoadingTable(false);
      }
    },
    [typeFilter, statusFilter, dateFrom, dateTo],
  );

  /* ── table: selection ────────────────────────────────────────────────── */

  const toggleSelect = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    if (selected.size === activities.length) setSelected(new Set());
    else setSelected(new Set(activities.map((a) => String(a._id ?? ''))));
  }, [selected.size, activities]);

  /* ── table: bulk complete ─────────────────────────────────────────────── */

  const handleBulkComplete = React.useCallback(async () => {
    if (selected.size === 0) return;
    setBulkWorking(true);
    try {
      const result = await bulkCompleteActivities([...selected]);
      if (result.error) {
        toast({ title: 'Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `${result.processed} activit${result.processed === 1 ? 'y' : 'ies'} completed` });
        void loadActivities(activitiesPage);
      }
    } finally {
      setBulkWorking(false);
    }
  }, [selected, activitiesPage, loadActivities, toast]);

  /* ── table: bulk delete ───────────────────────────────────────────────── */

  const handleBulkDelete = React.useCallback(async () => {
    if (selected.size === 0) return;
    setBulkWorking(true);
    try {
      const result = await bulkDeleteActivities([...selected]);
      if (result.error) {
        toast({ title: 'Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: `${result.processed} activit${result.processed === 1 ? 'y' : 'ies'} deleted` });
        void loadActivities(activitiesPage);
      }
    } finally {
      setBulkWorking(false);
    }
  }, [selected, activitiesPage, loadActivities, toast]);

  /* ── export CSV ───────────────────────────────────────────────────────── */

  const exportCsv = React.useCallback(() => {
    const headers = ['Type', 'Subject', 'Related', 'Assigned', 'Due date', 'Status', 'Notes'];
    const rows = activities.map((a) => [
      a.type,
      a.subject,
      a.relatedEntityKind && a.relatedEntityId
        ? `${a.relatedEntityKind}:${a.relatedEntityId}`
        : '',
      a.assignedUserId ?? '',
      a.dueDate ? new Date(a.dueDate).toLocaleDateString() : '',
      a.status,
      a.notes ?? '',
    ]);
    downloadCsv(`activities-${dateStamp()}.csv`, headers, rows);
  }, [activities]);

  /* ── feed bucket grouping ─────────────────────────────────────────────── */

  const bucketed = React.useMemo(() => {
    const groups: Record<Bucket, CrmActivityRow[]> = {
      Today: [], Yesterday: [], 'This week': [], Earlier: [],
    };
    for (const r of feedRows) {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      groups[bucketFor(t)].push(r);
    }
    return groups;
  }, [feedRows]);

  const hasFilters = Object.values(filters).some(Boolean);
  const totalPages = Math.ceil(activitiesTotal / 50);

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <EntityListShell
      title="Activity"
      subtitle="All CRM activities — calls, emails, meetings, tasks and notes, plus the tenant-wide audit trail."
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Activities today" value={String(kpis.activitiesToday)} />
        <StatCard label="Open activities" value={String(kpis.openActivities)} />
        <StatCard
          label="Overdue"
          value={String(kpis.overdueActivities)}
        />
        <StatCard label="Completed this week" value={String(kpis.completedThisWeek)} />
      </div>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="feed">Feed view</TabsTrigger>
          <TabsTrigger value="table">Table view</TabsTrigger>
        </TabsList>

        {/* ── Feed tab ─────────────────────────────────────────────────── */}
        <TabsContent value="feed" className="space-y-4">
          {/* Feed filters */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-44">
              <Label className="text-[11px]">Entity kind</Label>
              <Select
                value={filters.entityKind || 'all'}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, entityKind: v === 'all' ? '' : v }))
                }
              >
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="All entities" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All entities</ZoruSelectItem>
                  {['lead', 'deal', 'contact', 'invoice', 'project', 'task', 'ticket'].map(
                    (k) => (
                      <ZoruSelectItem key={k} value={k}>
                        {k}
                      </ZoruSelectItem>
                    ),
                  )}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-[11px]" htmlFor="feed-from">From</Label>
              <Input
                id="feed-from"
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              />
            </div>
            <div className="w-36">
              <Label className="text-[11px]" htmlFor="feed-to">To</Label>
              <Input
                id="feed-to"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={applyFeedFilters} className="mb-1">
              <Filter className="h-3.5 w-3.5" /> Apply
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFeedFilters} className="mb-1">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          {feedRows.length === 0 ? (
            <Card className="p-10 text-center text-[13px] text-zoru-ink-muted">
              No audit events yet.
            </Card>
          ) : (
            <>
              {BUCKETS_ORDER.map((b) =>
                bucketed[b].length === 0 ? null : (
                  <Card key={b} className="p-0">
                    <div className="flex items-center gap-2 border-b border-zoru-line p-4">
                      <h2 className="text-[14px] font-semibold text-zoru-ink">{b}</h2>
                      <Badge variant="secondary">{bucketed[b].length}</Badge>
                    </div>
                    <ul className="divide-y divide-zoru-line">
                      {bucketed[b].map((entry) => (
                        <ActivityRow key={entry._id} entry={entry} currentUserId={currentUserId} />
                      ))}
                    </ul>
                  </Card>
                ),
              )}
              {cursor ? (
                <div ref={observerTarget} className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleLoadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              ) : (
                <p className="py-3 text-center text-xs text-zoru-ink-muted">End of feed.</p>
              )}
            </>
          )}
        </TabsContent>

        {/* ── Table tab ────────────────────────────────────────────────── */}
        <TabsContent value="table" className="space-y-4">
          {/* Table filters */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Label className="text-[11px]">Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All types</ZoruSelectItem>
                  {(['call', 'email', 'meeting', 'task', 'note'] as CrmActivityType[]).map(
                    (t) => (
                      <ZoruSelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </ZoruSelectItem>
                    ),
                  )}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-[11px]">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                  <ZoruSelectItem value="open">Open</ZoruSelectItem>
                  <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                  <ZoruSelectItem value="overdue">Overdue</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-[11px]" htmlFor="tbl-from">From</Label>
              <Input
                id="tbl-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-36">
              <Label className="text-[11px]" htmlFor="tbl-to">To</Label>
              <Input
                id="tbl-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <Button size="sm" onClick={() => void loadActivities(1)} className="mb-1">
              <Filter className="h-3.5 w-3.5" /> Apply
            </Button>
            {(typeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-1"
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>

          {/* Bulk bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded border border-zoru-line bg-zoru-surface-2 px-3 py-2">
              <span className="text-[12.5px] text-zoru-ink">{selected.size} selected</span>
              <Button
                size="sm"
                onClick={() => void handleBulkComplete()}
                disabled={bulkWorking}
              >
                {bulkWorking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Complete
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleBulkDelete()}
                disabled={bulkWorking}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
              <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          )}

          <Card className="overflow-hidden p-0">
            {loadingTable ? (
              <div className="flex items-center justify-center p-10">
                <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
              </div>
            ) : activities.length === 0 ? (
              <div className="p-10 text-center text-[13px] text-zoru-ink-muted">
                No activities found. Activities created from entity detail pages will appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="hover:bg-transparent">
                      <ZoruTableHead className="w-8">
                        <input
                          type="checkbox"
                          checked={selected.size === activities.length && activities.length > 0}
                          onChange={toggleAll}
                          className="h-3.5 w-3.5"
                        />
                      </ZoruTableHead>
                      <ZoruTableHead>Type</ZoruTableHead>
                      <ZoruTableHead>Subject</ZoruTableHead>
                      <ZoruTableHead>Related to</ZoruTableHead>
                      <ZoruTableHead>Assigned</ZoruTableHead>
                      <ZoruTableHead>Due date</ZoruTableHead>
                      <ZoruTableHead>Status</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {activities.map((a) => {
                      const id = String(a._id ?? '');
                      return (
                        <ZoruTableRow key={id}>
                          <ZoruTableCell>
                            <input
                              type="checkbox"
                              checked={selected.has(id)}
                              onChange={() => toggleSelect(id)}
                              className="h-3.5 w-3.5"
                            />
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <div className="flex items-center gap-1.5">
                              <ActivityTypeIcon type={a.type} />
                              <span className="text-[12.5px] capitalize text-zoru-ink">
                                {a.type}
                              </span>
                            </div>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] font-medium text-zoru-ink">
                            {a.subject}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {a.relatedEntityKind && a.relatedEntityId ? (
                              <span>
                                {a.relatedEntityKind}{' '}
                                <span className="font-mono text-[11px]">
                                  {a.relatedEntityId.slice(-6)}
                                </span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                            {a.assignedUserId ? a.assignedUserId.slice(-6) : '—'}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                            {a.dueDate ? (
                              <span
                                className={
                                  a.status === 'overdue'
                                    ? 'font-medium text-zoru-danger-ink'
                                    : ''
                                }
                              >
                                {new Date(a.dueDate).toLocaleDateString()}
                              </span>
                            ) : (
                              '—'
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <StatusBadge status={a.status} />
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </Table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] text-zoru-ink-muted">
                Page {activitiesPage} of {totalPages} &middot;{' '}
                {activitiesTotal.toLocaleString()} activities
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activitiesPage <= 1}
                  onClick={() => void loadActivities(activitiesPage - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activitiesPage >= totalPages}
                  onClick={() => void loadActivities(activitiesPage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {/* Export (when no selection) */}
          {selected.size === 0 && activities.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </EntityListShell>
  );
}
