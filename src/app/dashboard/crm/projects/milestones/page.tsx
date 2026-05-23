'use client';

import {
  Button,
  Checkbox,
  StatCard,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Input,
  Label,
  Textarea,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import { useActionState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Flag,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
  X,
  } from 'lucide-react';

/**
 * Milestones — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: Total · Reached · Pending · Overdue)
 *     • Filter row (status · project)
 *     • Table columns: name · project · target date · status · cost · actions
 *
 * Inline create + edit dialog (settings-style §1D.4) — no separate /new
 * route to keep this milestone tab fast.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsProjectMilestones,
  saveWsProjectMilestone,
  deleteWsProjectMilestone,
  bulkDeleteWsMilestones,
  bulkCompleteMilestones,
} from '@/app/actions/worksuite/projects.actions';
import type { WsProjectMilestone } from '@/lib/worksuite/project-types';

type Row = WsProjectMilestone & { _id: string };

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(amt?: number | null, currency = 'INR'): string {
  if (typeof amt !== 'number' || Number.isNaN(amt)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amt);
  } catch {
    return `${currency} ${amt}`;
  }
}

function isReached(r: Row): boolean {
  return (r.status || '').toLowerCase() === 'complete';
}

function isOverdue(r: Row): boolean {
  if (isReached(r)) return false;
  const end = r.endDate;
  if (!end) return false;
  const d = new Date(end as string | Date);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export default function ProjectMilestonesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = React.useTransition();
  const [confirmBulk, setConfirmBulk] = React.useState<'complete' | 'delete' | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsProjectMilestones()) as unknown as Row[];
        setRows(list ?? []);
      } catch (e) {
        toast({
          title: 'Failed to load milestones',
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
      if (projectFilter && String(r.projectId ?? '') !== projectFilter) return false;
      if (!q) return true;
      const hay = [r.milestoneTitle, r.summary].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, projectFilter]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const reached = rows.filter(isReached).length;
    const pending = rows.filter((r) => !isReached(r) && !isOverdue(r)).length;
    const overdue = rows.filter(isOverdue).length;
    return { total, reached, pending, overdue };
  }, [rows]);

  const hasActiveFilters = statusFilter !== 'all' || !!projectFilter;

  const deleteTarget = React.useMemo(
    () => rows.find((r) => r._id === deleteTargetId) ?? null,
    [rows, deleteTargetId],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteWsProjectMilestone(deleteTargetId);
    if (res?.success) {
      toast({ title: 'Milestone deleted' });
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

  /* ── Bulk complete ───────────────────────────────────────────── */
  const handleBulkComplete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkCompleteMilestones(ids);
      if (res.updated > 0 || res.failed === 0) {
        toast({ title: `Completed ${res.updated} milestone${res.updated === 1 ? '' : 's'}` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk complete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  /* ── Bulk delete ─────────────────────────────────────────────── */
  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkDeleteWsMilestones(ids);
      if (res.deleted > 0 || res.failed === 0) {
        toast({ title: `Deleted ${res.deleted} milestone${res.deleted === 1 ? '' : 's'}` });
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
      ['Title', 'Project', 'Start', 'Target', 'Status', 'Payment', 'Currency'].join(','),
      ...exportRows.map((r) =>
        [
          JSON.stringify(r.milestoneTitle ?? ''),
          JSON.stringify(String(r.projectId ?? '')),
          JSON.stringify(fmtDate(r.startDate)),
          JSON.stringify(fmtDate(r.endDate)),
          JSON.stringify(r.status ?? ''),
          JSON.stringify(String(r.cost ?? '')),
          JSON.stringify(r.currency ?? 'INR'),
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'milestones.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filtered, selection]);

  return (
    <>
      <EntityListShell
        title="Milestones"
        subtitle="Key delivery checkpoints with target dates and payment percentages."
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search milestone title or summary…',
        }}
        primaryAction={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button asChild>
              <Link href="/dashboard/crm/projects/milestones/new">
                <Plus className="h-4 w-4" /> New milestone
              </Link>
            </Button>
          </>
        }
        bulkBar={
          selection.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selection.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('complete')} disabled={bulkPending}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete
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
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="incomplete">Incomplete</ZoruSelectItem>
                <ZoruSelectItem value="complete">Complete</ZoruSelectItem>
              </ZoruSelectContent>
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
              <Flag className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No milestones yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Milestones break a project into delivery checkpoints — useful
                for client billing and progress tracking.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/projects/milestones/new">
                  <Plus className="h-4 w-4" /> New milestone
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="Total"
              value={kpis.total.toLocaleString()}
              icon={<Flag className="h-4 w-4" />}
            />
            <StatCard
              label="Reached"
              value={kpis.reached.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <StatCard
              label="Pending"
              value={kpis.pending.toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
            <StatCard
              label="Overdue"
              value={kpis.overdue.toLocaleString()}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          {filtered.length === 0 && !loading ? null : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      {(() => {
                        const allCk = filtered.length > 0 && filtered.every((r) => selection.has(r._id));
                        const someCk = !allCk && filtered.some((r) => selection.has(r._id));
                        return (
                          <Checkbox
                            checked={allCk || (someCk ? 'indeterminate' : false)}
                            onCheckedChange={(v) => handleToggleAll(!!v)}
                            aria-label="Select all"
                          />
                        );
                      })()}
                    </ZoruTableHead>
                    <ZoruTableHead>Name</ZoruTableHead>
                    <ZoruTableHead>Project</ZoruTableHead>
                    <ZoruTableHead>Start</ZoruTableHead>
                    <ZoruTableHead>Target</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead className="text-right">Payment</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.map((r) => {
                    const overdue = isOverdue(r);
                    return (
                      <ZoruTableRow
                        key={r._id}
                        className={[
                          'border-zoru-line transition-colors',
                          overdue ? 'border-l-2 border-l-zoru-danger' : '',
                          isReached(r) ? 'opacity-70' : '',
                        ].join(' ')}
                      >
                        <ZoruTableCell>
                          <Checkbox
                            checked={selection.has(r._id)}
                            onCheckedChange={() => handleToggle(r._id)}
                            aria-label={`Select ${r.milestoneTitle ?? 'milestone'}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/projects/milestones/${r._id}`}
                            label={r.milestoneTitle || 'Untitled'}
                            subtitle={r.summary || undefined}
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
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                          {fmtDate(r.startDate)}
                        </ZoruTableCell>
                        <ZoruTableCell
                          className={[
                            'text-[12.5px]',
                            overdue ? 'text-zoru-danger' : 'text-zoru-ink-muted',
                          ].join(' ')}
                        >
                          {fmtDate(r.endDate)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={r.status}
                            tone={statusToTone(r.status)}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] text-zoru-ink">
                          {fmtMoney(Number(r.cost) || null, r.currency ?? 'INR')}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Actions for ${r.milestoneTitle}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                              <ZoruDropdownMenuItem asChild>
                                <Link href={`/dashboard/crm/projects/milestones/${r._id}/edit`}>
                                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                onClick={() => setDeleteTargetId(r._id)}
                                className="text-zoru-danger"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </DropdownMenu>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </Table>
            </div>
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this milestone?"
        description={`This permanently removes "${deleteTarget?.milestoneTitle ?? 'milestone'}". This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      {/* Bulk complete confirm */}
      <ConfirmDialog
        open={confirmBulk === 'complete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Mark ${selection.size} milestone${selection.size === 1 ? '' : 's'} complete?`}
        description="The selected milestones will be marked as complete. This can be reversed by editing each milestone."
        confirmLabel="Mark complete"
        onConfirm={handleBulkComplete}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={confirmBulk === 'delete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Delete ${selection.size} milestone${selection.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected milestones. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

// suppress unused-icon warning — Target reserved for future "payment %" rail
void Target;
