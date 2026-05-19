'use client';

import {
  ZoruButton,
  ZoruStatCard,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruInput,
  ZoruBadge,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Zap,
  } from 'lucide-react';

/**
 * Issues — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: Open · Critical (urgent priority) · Resolved this month · Avg resolution days)
 *     • Filter row (status · priority · project)
 *     • View switcher (Table / Kanban)
 *     • Table columns: title · project · priority · assignee · status · created · actions
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsIssues,
  deleteWsIssue,
} from '@/app/actions/worksuite/projects.actions';
import type { WsIssue } from '@/lib/worksuite/project-types';

type Row = WsIssue & { _id: string };
type ViewMode = 'table' | 'kanban';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const PRIORITY_TONE: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function isResolved(s: string | undefined): boolean {
  const l = (s ?? '').toLowerCase();
  return l === 'resolved' || l === 'closed';
}

export default function ProjectIssuesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('');
  const [view, setView] = React.useState<ViewMode>('table');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsIssues()) as unknown as Row[];
        setRows(list ?? []);
      } catch (e) {
        toast({
          title: 'Failed to load issues',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useDebouncedCallback((v: string) => setSearch(v), 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && (r.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (
        priorityFilter !== 'all' &&
        (r.priority || '').toLowerCase() !== priorityFilter
      ) {
        return false;
      }
      if (projectFilter && String(r.projectId ?? '') !== projectFilter) return false;
      if (!q) return true;
      const hay = [r.title, r.description, r.reporterName, r.assigneeName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, priorityFilter, projectFilter]);

  const kpis = React.useMemo(() => {
    const open = rows.filter((r) => !isResolved(r.status)).length;
    const critical = rows.filter(
      (r) => !isResolved(r.status) && (r.priority ?? '').toLowerCase() === 'urgent',
    ).length;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const resolved = rows.filter((r) => {
      if (!isResolved(r.status)) return false;
      const d = r.updatedAt ? new Date(r.updatedAt as string | Date).getTime() : 0;
      return d > monthAgo;
    });
    // Avg resolution days
    let avgDays = 0;
    if (resolved.length > 0) {
      const total = resolved.reduce((sum, r) => {
        const a = r.createdAt ? new Date(r.createdAt as string | Date).getTime() : 0;
        const b = r.updatedAt ? new Date(r.updatedAt as string | Date).getTime() : 0;
        if (!a || !b || b <= a) return sum;
        return sum + (b - a) / (24 * 60 * 60 * 1000);
      }, 0);
      avgDays = Math.round(total / resolved.length);
    }
    return { open, critical, resolvedMonth: resolved.length, avgDays };
  }, [rows]);

  const hasActiveFilters =
    statusFilter !== 'all' || priorityFilter !== 'all' || !!projectFilter;

  const deleteTarget = React.useMemo(
    () => rows.find((r) => r._id === deleteTargetId) ?? null,
    [rows, deleteTargetId],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteWsIssue(deleteTargetId);
    if (res?.success) {
      toast({ title: 'Issue deleted' });
      refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error ?? 'Unknown error',
        variant: 'destructive',
      });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, refresh, toast]);

  const viewBtn = (mode: ViewMode, label: string, Icon: React.ElementType) => (
    <button
      key={mode}
      type="button"
      onClick={() => setView(mode)}
      aria-pressed={view === mode}
      className={[
        'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[12px]',
        view === mode
          ? 'bg-zoru-surface text-zoru-ink'
          : 'text-zoru-ink-muted hover:text-zoru-ink',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <>
      <EntityListShell
        title="Issues"
        subtitle="Bugs, blockers, and incidents tracked against your projects."
        viewSwitcher={
          <div className="inline-flex rounded-md border border-zoru-line p-0.5">
            {viewBtn('table', 'Table', List)}
            {viewBtn('kanban', 'Kanban', LayoutGrid)}
          </div>
        }
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search title, reporter, assignee…',
        }}
        primaryAction={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/projects/issues/new">
              <Plus className="h-4 w-4" /> New issue
            </Link>
          </ZoruButton>
        }
        filters={
          <>
            <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={priorityFilter} onValueChange={setPriorityFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Priority" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All priorities</ZoruSelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Project id"
              className="h-9 w-[200px] text-[13px]"
            />
            {hasActiveFilters ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setProjectFilter('');
                }}
              >
                Clear filters
              </ZoruButton>
            ) : null}
          </>
        }
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Bug className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No issues yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Track bugs, blockers, and incidents against your projects.
              </p>
              <ZoruButton asChild>
                <Link href="/dashboard/crm/projects/issues/new">
                  <Plus className="h-4 w-4" /> New issue
                </Link>
              </ZoruButton>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="Open"
              value={kpis.open.toLocaleString()}
              icon={<Bug className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Critical (urgent)"
              value={kpis.critical.toLocaleString()}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Resolved (30d)"
              value={kpis.resolvedMonth.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Avg resolution"
              value={`${kpis.avgDays}d`}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {view === 'table' ? (
            <IssuesTable
              rows={filtered}
              onDelete={(id) => setDeleteTargetId(id)}
            />
          ) : (
            <IssuesKanban rows={filtered} />
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this issue?"
        description={`This permanently removes "${deleteTarget?.title ?? 'issue'}". This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

/* ───── Table ───── */
function IssuesTable({
  rows,
  onDelete,
}: {
  rows: Row[];
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zoru-line p-6 text-center text-[13px] text-zoru-ink-muted">
        No issues match the current filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            <ZoruTableHead>Title</ZoruTableHead>
            <ZoruTableHead>Project</ZoruTableHead>
            <ZoruTableHead>Priority</ZoruTableHead>
            <ZoruTableHead>Reporter</ZoruTableHead>
            <ZoruTableHead>Assignee</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Created</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.map((r) => {
            const priorityLower = (r.priority ?? 'medium').toLowerCase();
            return (
              <ZoruTableRow key={r._id} className="border-zoru-line transition-colors">
                <ZoruTableCell>
                  <EntityRowLink
                    href={`/dashboard/crm/projects/issues/${r._id}`}
                    label={r.title}
                    subtitle={r.description || undefined}
                  />
                </ZoruTableCell>
                <ZoruTableCell>
                  {r.projectId ? (
                    <EntityPickerChip
                      entity="project"
                      id={String(r.projectId)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">—</span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  <StatusPill
                    label={r.priority || 'medium'}
                    tone={PRIORITY_TONE[priorityLower] ?? 'neutral'}
                  />
                </ZoruTableCell>
                <ZoruTableCell>
                  {r.reporterUserId ? (
                    <EntityPickerChip
                      entity="user"
                      id={String(r.reporterUserId)}
                      fallback={r.reporterName || '—'}
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">
                      {r.reporterName || '—'}
                    </span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  {r.assigneeUserId ? (
                    <EntityPickerChip
                      entity="user"
                      id={String(r.assigneeUserId)}
                      fallback={r.assigneeName || '—'}
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">
                      {r.assigneeName || 'Unassigned'}
                    </span>
                  )}
                </ZoruTableCell>
                <ZoruTableCell>
                  <StatusPill label={r.status} tone={statusToTone(r.status)} />
                </ZoruTableCell>
                <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                  {fmtDate(r.createdAt)}
                </ZoruTableCell>
                <ZoruTableCell className="text-right">
                  <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${r.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/projects/issues/${r._id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/projects/issues/${r._id}/edit`}>
                          <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                      </ZoruDropdownMenuItem>
                      <ZoruDropdownMenuItem
                        onClick={() => onDelete(r._id)}
                        className="text-zoru-danger"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                  </ZoruDropdownMenu>
                </ZoruTableCell>
              </ZoruTableRow>
            );
          })}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}

/* ───── Kanban (by-status) ───── */
function IssuesKanban({ rows }: { rows: Row[] }) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const o of STATUS_OPTIONS) map.set(o.value, []);
    for (const r of rows) {
      const k = (r.status || 'open').toLowerCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return map;
  }, [rows]);

  return (
    <div className="flex w-full gap-3 overflow-x-auto pb-3">
      {STATUS_OPTIONS.map((stage) => {
        const cards = grouped.get(stage.value) ?? [];
        return (
          <div
            key={stage.value}
            className="flex w-[280px] shrink-0 flex-col gap-2"
          >
            <header className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[12px] font-medium uppercase tracking-wider text-zoru-ink-muted">
                {stage.label}
              </span>
              <ZoruBadge variant="secondary">{cards.length}</ZoruBadge>
            </header>
            <div className="flex flex-col gap-2">
              {cards.map((r) => {
                const priorityLower = (r.priority ?? '').toLowerCase();
                return (
                  <Link
                    key={r._id}
                    href={`/dashboard/crm/projects/issues/${r._id}`}
                    className="block rounded-md border border-zoru-line bg-zoru-surface p-3 text-[13px] transition hover:border-zoru-primary"
                  >
                    <p className="font-medium text-zoru-ink">{r.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {r.priority ? (
                        <StatusPill
                          label={r.priority}
                          tone={PRIORITY_TONE[priorityLower] ?? 'neutral'}
                        />
                      ) : (
                        <span />
                      )}
                      <span className="text-[11.5px] text-zoru-ink-muted">
                        {fmtDate(r.createdAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {cards.length === 0 ? (
                <p className="rounded-md border border-dashed border-zoru-line p-3 text-center text-[11.5px] text-zoru-ink-muted">
                  No issues
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// reserve icon — used in legend in future
void Zap;
