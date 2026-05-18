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
  ZoruLabel,
  ZoruTextarea,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDropdownMenu,
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
  Edit,
  Flag,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
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

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsProjectMilestones,
  saveWsProjectMilestone,
  deleteWsProjectMilestone,
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Row | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

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
          <ZoruButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New milestone
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
                <ZoruSelectItem value="incomplete">Incomplete</ZoruSelectItem>
                <ZoruSelectItem value="complete">Complete</ZoruSelectItem>
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
              <Flag className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No milestones yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Milestones break a project into delivery checkpoints — useful
                for client billing and progress tracking.
              </p>
              <ZoruButton onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New milestone
              </ZoruButton>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="Total"
              value={kpis.total.toLocaleString()}
              icon={<Flag className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Reached"
              value={kpis.reached.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Pending"
              value={kpis.pending.toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Overdue"
              value={kpis.overdue.toLocaleString()}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
          </div>

          {filtered.length === 0 && !loading ? null : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
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
                          <button
                            type="button"
                            className="text-left font-medium text-zoru-ink hover:underline"
                            onClick={() => setEditTarget(r)}
                          >
                            {r.milestoneTitle || 'Untitled'}
                          </button>
                          {r.summary ? (
                            <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
                              {r.summary}
                            </p>
                          ) : null}
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
                          <ZoruDropdownMenu>
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
                              <ZoruDropdownMenuItem onClick={() => setEditTarget(r)}>
                                <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                onClick={() => setDeleteTargetId(r._id)}
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
          )}
        </div>
      </EntityListShell>

      <MilestoneDialog
        open={createOpen || !!editTarget}
        initial={editTarget ?? undefined}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onSaved={() => {
          setCreateOpen(false);
          setEditTarget(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this milestone?"
        description={`This permanently removes "${deleteTarget?.milestoneTitle ?? 'milestone'}". This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

/* ───── Create / Edit dialog ───── */
interface MilestoneDialogProps {
  open: boolean;
  initial?: Row;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

function MilestoneDialog({ open, initial, onOpenChange, onSaved }: MilestoneDialogProps) {
  const { toast } = useZoruToast();
  const [state, action] = useActionState(
    async (
      _prev: { message?: string; error?: string; id?: string } | null,
      formData: FormData,
    ) => {
      const res = await saveWsProjectMilestone(_prev, formData);
      if (res.error) {
        toast({
          title: 'Save failed',
          description: res.error,
          variant: 'destructive',
        });
        return res;
      }
      toast({ title: initial?._id ? 'Milestone updated' : 'Milestone created' });
      onSaved();
      return res;
    },
    null,
  );

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {initial?._id ? 'Edit milestone' : 'New milestone'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Milestones are checkpoints attached to a project, optionally with a cost and target date.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form action={action} className="space-y-3">
          {initial?._id ? (
            <input type="hidden" name="_id" defaultValue={initial._id} />
          ) : null}
          <div>
            <ZoruLabel>
              Project <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <EntityFormField
              entity="project"
              name="projectId"
              initialId={initial?.projectId ? String(initial.projectId) : undefined}
              placeholder="Pick a project"
              required
            />
          </div>
          <div>
            <ZoruLabel htmlFor="milestoneTitle">
              Title <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <ZoruInput
              id="milestoneTitle"
              name="milestoneTitle"
              defaultValue={initial?.milestoneTitle ?? ''}
              required
            />
          </div>
          <div>
            <ZoruLabel htmlFor="summary">Summary / deliverables</ZoruLabel>
            <ZoruTextarea
              id="summary"
              name="summary"
              defaultValue={initial?.summary ?? ''}
              rows={3}
              placeholder="What needs to be delivered for this milestone?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="startDate">Start</ZoruLabel>
              <ZoruInput
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  initial?.startDate
                    ? new Date(initial.startDate as string | Date)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
              />
            </div>
            <div>
              <ZoruLabel htmlFor="endDate">Target date</ZoruLabel>
              <ZoruInput
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={
                  initial?.endDate
                    ? new Date(initial.endDate as string | Date)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="cost">Cost / payment</ZoruLabel>
              <ZoruInput
                id="cost"
                name="cost"
                type="number"
                step="0.01"
                defaultValue={String(initial?.cost ?? '')}
              />
            </div>
            <div>
              <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
              <ZoruInput
                id="currency"
                name="currency"
                defaultValue={initial?.currency ?? 'INR'}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <ZoruSelect name="status" defaultValue={initial?.status ?? 'incomplete'}>
              <ZoruSelectTrigger id="status">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="incomplete">Incomplete</ZoruSelectItem>
                <ZoruSelectItem value="complete">Complete</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          {state?.error ? (
            <p className="text-sm text-zoru-danger-ink">{state.error}</p>
          ) : null}
          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit">
              {initial?._id ? 'Save changes' : 'Create milestone'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

// suppress unused-icon warning — Target reserved for future "payment %" rail
void Target;
