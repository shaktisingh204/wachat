'use client';

import * as React from 'react';
import {
  Button,
  Card,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  Activity,
  CalendarRange,
  Crown,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Trash2,
  User,
} from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';
import type { WsProjectActivity } from '@/lib/worksuite/project-types';

type Row = WsProjectActivity & { _id: string };

export interface ActivityTimelinePageProps {
  getList: () => Promise<Row[]>;
  bulkDelete: (ids: string[]) => Promise<{ deleted: number; failed: number; error?: string }>;
}

const PAGE_SIZE = 25;

function fmt(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function inferKind(activity: string | undefined): string {
  if (!activity) return 'other';
  const s = activity.toLowerCase();
  if (s.includes('task')) return 'task';
  if (s.includes('milestone')) return 'milestone';
  if (s.includes('file') || s.includes('upload')) return 'file';
  if (s.includes('note')) return 'note';
  if (s.includes('member') || s.includes('assignee')) return 'member';
  if (s.includes('project')) return 'project';
  return 'other';
}

function inferAction(activity: string | undefined): string {
  if (!activity) return 'other';
  const s = activity.toLowerCase();
  if (s.includes('created') || s.includes('added')) return 'created';
  if (s.includes('updated') || s.includes('edited')) return 'updated';
  if (s.includes('deleted') || s.includes('removed')) return 'deleted';
  if (s.includes('completed') || s.includes('done')) return 'completed';
  if (s.includes('commented')) return 'commented';
  return 'other';
}

export function ActivityTimelinePage({ getList, bulkDelete }: ActivityTimelinePageProps) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [isLoading, startLoading] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [actorFilter, setActorFilter] = React.useState('all');
  const [kindFilter, setKindFilter] = React.useState('all');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const load = React.useCallback(() => {
    startLoading(async () => {
      const list = await getList();
      setRows(
        list.slice().sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }),
      );
    });
  }, [getList]);

  React.useEffect(() => {
    load();
  }, [load]);

  const actors = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.actorName) set.add(r.actorName);
    }
    return Array.from(set).sort();
  }, [rows]);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfDay - 7 * 24 * 60 * 60 * 1000;

  const { eventsToday, eventsWeek, topActor, topAction } = React.useMemo(() => {
    let today = 0;
    let week = 0;
    const actorCounts = new Map<string, number>();
    const actionCounts = new Map<string, number>();
    for (const r of rows) {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
      if (Number.isFinite(t)) {
        if (t >= startOfDay) today += 1;
        if (t >= sevenDaysAgo) week += 1;
      }
      const a = r.actorName || 'Unknown';
      actorCounts.set(a, (actorCounts.get(a) ?? 0) + 1);
      const k = inferAction(r.activity);
      actionCounts.set(k, (actionCounts.get(k) ?? 0) + 1);
    }
    const sortMap = (m: Map<string, number>) =>
      Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    const ta = sortMap(actorCounts);
    const tk = sortMap(actionCounts);
    return {
      eventsToday: today,
      eventsWeek: week,
      topActor: ta ? `${ta[0]} (${ta[1]})` : '—',
      topAction: tk ? `${tk[0]} (${tk[1]})` : '—',
    };
  }, [rows, startOfDay, sevenDaysAgo]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = from ? new Date(from).getTime() : null;
    const toTs = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : null;
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.activity ?? ''} ${r.actorName ?? ''} ${String(r.projectId ?? '')}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (actorFilter !== 'all' && r.actorName !== actorFilter) return false;
      if (kindFilter !== 'all' && inferKind(r.activity) !== kindFilter) return false;
      if (fromTs != null || toTs != null) {
        const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
        if (!Number.isFinite(t)) return false;
        if (fromTs != null && t < fromTs) return false;
        if (toTs != null && t > toTs) return false;
      }
      return true;
    });
  }, [rows, q, actorFilter, kindFilter, from, to]);

  React.useEffect(() => {
    setPage(1);
  }, [q, actorFilter, kindFilter, from, to, limit]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * limit, pageSafe * limit),
    [filtered, pageSafe, limit],
  );

  const buildExport = (subset: Row[]): { headers: string[]; rows: ExportRow[] } => {
    const headers = ['When', 'Project', 'Actor', 'Kind', 'Action', 'Activity'];
    const out: ExportRow[] = subset.map((r) => ({
      When: fmt(r.createdAt),
      Project: String(r.projectId ?? ''),
      Actor: r.actorName ?? '',
      Kind: inferKind(r.activity),
      Action: inferAction(r.activity),
      Activity: r.activity ?? '',
    }));
    return { headers, rows: out };
  };

  const onExportCsv = (subset: Row[]) => {
    const { headers, rows: out } = buildExport(subset);
    downloadCsv(`project-activity-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = (subset: Row[]) => {
    const { headers, rows: out } = buildExport(subset);
    void downloadXlsx(`project-activity-${dateStamp()}.xlsx`, headers, out, 'Activity');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const r = await bulkDelete(ids);
    if (r.failed === 0) {
      toast({ title: 'Deleted', description: `${r.deleted} event(s) removed` });
    } else {
      toast({
        title: 'Partial failure',
        description: `${r.deleted} deleted, ${r.failed} failed`,
        variant: 'destructive',
      });
    }
    setSelected(new Set());
    setPendingBulk(false);
    load();
  };

  return (
    <>
      <EntityListShell
        title="Project Activity"
        subtitle="Timeline of what happened across your projects."
        search={{ value: q, onChange: setQ, placeholder: 'Search activity…' }}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onExportCsv(filtered)}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExportXlsx(filtered)}>
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
              XLSX
            </Button>
          </div>
        }
        filters={
          <>
            <div className="w-48">
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Actor" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All actors</ZoruSelectItem>
                  {actors.map((a) => (
                    <ZoruSelectItem key={a} value={a}>{a}</ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={kindFilter} onValueChange={setKindFilter}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Entity kind" /></ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All kinds</ZoruSelectItem>
                  <ZoruSelectItem value="project">Project</ZoruSelectItem>
                  <ZoruSelectItem value="task">Task</ZoruSelectItem>
                  <ZoruSelectItem value="milestone">Milestone</ZoruSelectItem>
                  <ZoruSelectItem value="file">File</ZoruSelectItem>
                  <ZoruSelectItem value="note">Note</ZoruSelectItem>
                  <ZoruSelectItem value="member">Member</ZoruSelectItem>
                  <ZoruSelectItem value="other">Other</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-zoru-ink-muted">From</span>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <span className="text-[12px] text-zoru-ink-muted">To</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
            </div>
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-zoru-ink-muted">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportCsv(rows.filter((r) => selected.has(r._id)))}
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Export selected
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingBulk(true)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} /> Delete selected
                </Button>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Events today" value={eventsToday.toLocaleString('en-IN')} icon={<Activity className="h-4 w-4" />} />
            <StatCard label="Events this week" value={eventsWeek.toLocaleString('en-IN')} icon={<CalendarRange className="h-4 w-4" />} period="last 7 days" />
            <StatCard label="Top actor" value={topActor} icon={<Crown className="h-4 w-4" />} />
            <StatCard label="Top action" value={topAction} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          <Card className="p-0">
            <ol className="relative divide-y divide-zoru-line">
              {pageRows.length === 0 ? (
                <li className="px-6 py-10 text-center text-zoru-ink-muted">
                  {rows.length === 0
                    ? 'No project activity recorded yet.'
                    : 'No activity matches the current filters.'}
                </li>
              ) : (
                pageRows.map((r) => {
                  const isSel = selected.has(r._id);
                  return (
                    <li key={r._id} className="flex items-start gap-4 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => {
                          setSelected((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(r._id);
                            else next.delete(r._id);
                            return next;
                          });
                        }}
                        className="mt-1.5 h-4 w-4 cursor-pointer rounded border-zoru-line"
                        aria-label={`Select activity ${r._id}`}
                      />
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zoru-line bg-zoru-surface-2">
                        <User className="h-3.5 w-3.5 text-zoru-ink-muted" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[13px] font-medium text-zoru-ink">{r.actorName ?? 'Unknown'}</span>
                          <span className="text-[12px] text-zoru-ink-muted">{fmt(r.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-zoru-ink">{r.activity}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zoru-ink-muted">
                          {r.projectId ? <span>Project: {String(r.projectId)}</span> : null}
                          <span className="rounded-full border border-zoru-line px-2 py-0.5">
                            {inferKind(r.activity)}
                          </span>
                          <span className="rounded-full border border-zoru-line px-2 py-0.5">
                            {inferAction(r.activity)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
            <PaginationBar
              page={pageSafe}
              limit={limit}
              hasMore={pageSafe < totalPages}
              total={filtered.length}
              controlled={{
                onChange: (next) => {
                  setPage(next.page);
                  setLimit(next.limit);
                },
              }}
            />
          </Card>
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={pendingBulk}
        onOpenChange={setPendingBulk}
        title={`Delete ${selected.size} activity event(s)?`}
        description="Removing these events cannot be undone."
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
