'use client';

import {
  Button,
  Checkbox,
  StatCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  UserCheck,
  X,
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
import SavedViewsBar from '@/components/crm/SavedViewsBar';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsIssues,
  getWsIssuesKpis,
  deleteWsIssue,
  bulkDeleteWsIssues,
  bulkUpdateWsIssues,
} from '@/app/actions/worksuite/projects.actions';
import type { WsIssue } from '@/lib/worksuite/project-types';
import { issueSchema } from './schema';

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
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().split('T')[0];
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
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = React.useTransition();
  const [confirmBulk, setConfirmBulk] = React.useState<'close' | 'delete' | null>(null);

  const [kpis, setKpis] = React.useState({ open: 0, critical: 0, resolvedThisMonth: 0, avgResolutionDays: 0 });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const rawList = await getWsIssues();
        const list = Array.isArray(rawList) ? rawList.map(r => issueSchema.parse(r) as Row) : [];
        setRows(list);
        
        const kpiData = await getWsIssuesKpis();
        setKpis(kpiData);
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
      setSelection((prev) => { const n = new Set(prev); n.delete(deleteTargetId); return n; });
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

  /* ── Selection helpers ───────────────────────────────────────── */
  const handleToggle = React.useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback((checked: boolean) => {
    setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set());
  }, [filtered]);

  /* ── Bulk ops ────────────────────────────────────────────────── */
  const handleBulkClose = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkUpdateWsIssues(ids, 'close');
      if (res.updated > 0 || res.failed === 0) {
        toast({ title: `Closed ${res.updated} issue${res.updated === 1 ? '' : 's'}` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk close failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkDeleteWsIssues(ids);
      if (res.deleted > 0 || res.failed === 0) {
        toast({ title: `Deleted ${res.deleted} issue${res.deleted === 1 ? '' : 's'}` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  /* ── CSV export ──────────────────────────────────────────────── */
  const handleExport = React.useCallback(() => {
    const exportRows = selection.size > 0
      ? filtered.filter((r) => selection.has(r._id))
      : filtered;
    const lines = [
      ['Title', 'Project', 'Priority', 'Reporter', 'Assignee', 'Status', 'Created'].join(','),
      ...exportRows.map((r) =>
        [
          JSON.stringify(r.title ?? ''),
          JSON.stringify(String(r.projectId ?? '')),
          JSON.stringify(r.priority ?? ''),
          JSON.stringify(r.reporterName ?? ''),
          JSON.stringify(r.assigneeName ?? ''),
          JSON.stringify(r.status ?? ''),
          JSON.stringify(fmtDate(r.createdAt)),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'issues.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filtered, selection]);

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
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button asChild>
              <Link href="/dashboard/crm/projects/issues/new">
                <Plus className="h-4 w-4" /> New issue
              </Link>
            </Button>
          </>
        }
        bulkBar={
          selection.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-zoru-surface-2 px-3 py-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selection.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('close')} disabled={bulkPending}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Close
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" size="sm" className="text-zoru-danger" onClick={() => setConfirmBulk('delete')} disabled={bulkPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelection(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null
        }
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] text-[13px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 w-[160px] text-[13px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              placeholder="Project id"
              className="h-9 w-[200px] text-[13px]"
            />
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setProjectFilter('');
                }}
              >
                Clear filters
              </Button>
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
              <Button asChild>
                <Link href="/dashboard/crm/projects/issues/new">
                  <Plus className="h-4 w-4" /> New issue
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <SavedViewsBar
            entityKind="ws_issue"
            currentFilters={{ status: statusFilter, priority: priorityFilter, project: projectFilter }}
            currentColumns={[]}
            onApplyView={(v) => {
              setStatusFilter((v.filters.status as string) || 'all');
              setPriorityFilter((v.filters.priority as string) || 'all');
              setProjectFilter((v.filters.project as string) || '');
            }}
          />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Open"
              value={kpis.open.toLocaleString()}
              icon={<Bug className="h-4 w-4" />}
            />
            <StatCard
              label="Critical (urgent)"
              value={kpis.critical.toLocaleString()}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <StatCard
              label="Resolved this month"
              value={kpis.resolvedThisMonth.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Avg resolution"
              value={`${kpis.avgResolutionDays}d`}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {view === 'table' ? (
            <IssuesTable
              rows={filtered}
              selection={selection}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
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

      {/* Bulk close confirm */}
      <ConfirmDialog
        open={confirmBulk === 'close'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Close ${selection.size} issue${selection.size === 1 ? '' : 's'}?`}
        description="The selected issues will be marked as closed. This can be reversed by editing each issue."
        confirmLabel="Close issues"
        onConfirm={handleBulkClose}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={confirmBulk === 'delete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Delete ${selection.size} issue${selection.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected issues. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

/* ───── Table ───── */
function IssuesTable({
  rows,
  selection,
  onToggle,
  onToggleAll,
  onDelete,
}: {
  rows: Row[];
  selection: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const allChecked = rows.length > 0 && rows.every((r) => selection.has(r._id));
  const someChecked = !allChecked && rows.some((r) => selection.has(r._id));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-zoru-line p-6 text-center text-[13px] text-zoru-ink-muted">
        No issues match the current filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <Table>
        <TableHeader>
          <TableRow className="border-zoru-line hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={allChecked || (someChecked ? 'indeterminate' : false)}
                onCheckedChange={(v) => onToggleAll(!!v)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Reporter</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const priorityLower = (r.priority ?? 'medium').toLowerCase();
            return (
              <TableRow key={r._id} className="border-zoru-line transition-colors">
                <TableCell>
                  <Checkbox
                    checked={selection.has(r._id)}
                    onCheckedChange={() => onToggle(r._id)}
                    aria-label={`Select ${r.title}`}
                  />
                </TableCell>
                <TableCell>
                  <EntityRowLink
                    href={`/dashboard/crm/projects/issues/${r._id}`}
                    label={r.title}
                    subtitle={r.description || undefined}
                  />
                </TableCell>
                <TableCell>
                  {r.projectId ? (
                    <EntityPickerChip
                      entity="project"
                      id={String(r.projectId)}
                      fallback="—"
                    />
                  ) : (
                    <span className="text-[12px] text-zoru-ink-muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusPill
                    label={r.priority || 'medium'}
                    tone={PRIORITY_TONE[priorityLower] ?? 'neutral'}
                  />
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  <StatusPill label={r.status} tone={statusToTone(r.status)} />
                </TableCell>
                <TableCell className="text-[12.5px] text-zoru-ink-muted">
                  {fmtDate(r.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${r.title}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/projects/issues/${r._id}`}>
                          <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/crm/projects/issues/${r._id}/edit`}>
                          <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(r._id)}
                        className="text-zoru-danger"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
              <Badge variant="secondary">{cards.length}</Badge>
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
