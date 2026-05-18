'use client';

import {
  ZoruButton,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  TrendingUp,
  } from 'lucide-react';

/**
 * Weekly Timesheets — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: Submitted · Pending approval · Approved · Avg hours/employee)
 *     • Filter row (status · employee · week range)
 *     • Table columns: employee · week of · total hours · status · submitted at · approver · actions
 *
 * Inline create + edit dialog. Detail at
 * `/dashboard/crm/time-tracking/weekly-timesheets/[timesheetId]` (preserved).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWeeklyTimesheets,
  saveWeeklyTimesheet,
  deleteWeeklyTimesheet,
  submitWeeklyTimesheet,
  approveWeeklyTimesheet,
} from '@/app/actions/worksuite/time.actions';
import type { WsWeeklyTimesheet } from '@/lib/worksuite/time-types';

type Row = WsWeeklyTimesheet & { _id: string };

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export default function WeeklyTimesheetsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = React.useState<string>('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Row | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWeeklyTimesheets()) as unknown as Row[];
        setRows(list ?? []);
      } catch (e) {
        toast({
          title: 'Failed to load timesheets',
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
      if (statusFilter !== 'all' && (r.status || '') !== statusFilter) return false;
      if (employeeFilter && String(r.user_id ?? '') !== employeeFilter) return false;
      if (!q) return true;
      return (r.reason || '').toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter, employeeFilter]);

  const kpis = React.useMemo(() => {
    const submitted = rows.filter((r) => r.status === 'submitted').length;
    const pending = rows.filter(
      (r) => r.status === 'submitted' || r.status === 'draft',
    ).length;
    const approved = rows.filter((r) => r.status === 'approved').length;
    const uniqueEmps = new Set(rows.map((r) => String(r.user_id))).size || 1;
    const totalH = rows.reduce(
      (s, r) =>
        s + ((Number(r.total_hours) || 0) + (Number(r.total_minutes) || 0) / 60),
      0,
    );
    const avg = uniqueEmps > 0 ? Math.round((totalH / uniqueEmps) * 10) / 10 : 0;
    return { submitted, pending, approved, avg };
  }, [rows]);

  const hasActiveFilters = statusFilter !== 'all' || !!employeeFilter;

  const deleteRow = React.useMemo(
    () => rows.find((r) => r._id === deleteId) ?? null,
    [rows, deleteId],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteId) return;
    const res = await deleteWeeklyTimesheet(deleteId);
    if (res?.success) {
      toast({ title: 'Timesheet deleted' });
      refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error ?? 'Unknown error',
        variant: 'destructive',
      });
    }
    setDeleteId(null);
  }, [deleteId, refresh, toast]);

  const handleSubmit = React.useCallback(
    async (id: string) => {
      const res = await submitWeeklyTimesheet(id);
      if (res.ok) {
        toast({ title: 'Timesheet submitted' });
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    },
    [refresh, toast],
  );

  const handleApprove = React.useCallback(
    async (id: string) => {
      const res = await approveWeeklyTimesheet(id);
      if (res.ok) {
        toast({ title: 'Timesheet approved' });
        refresh();
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    },
    [refresh, toast],
  );

  return (
    <>
      <EntityListShell
        title="Weekly Timesheets"
        subtitle="Per-employee weekly grids. Submit for review, then approve or reject."
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search reason / notes…',
        }}
        primaryAction={
          <ZoruButton onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New timesheet
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
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="submitted">Submitted</ZoruSelectItem>
                <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruInput
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Employee id"
              className="h-9 w-[200px] text-[13px]"
            />
            {hasActiveFilters ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setEmployeeFilter('');
                }}
              >
                Clear
              </ZoruButton>
            ) : null}
          </>
        }
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <CalendarRange className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">
                No timesheets yet
              </h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Create weekly timesheets to collect hours from your team and
                approve them in one place.
              </p>
              <ZoruButton onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New timesheet
              </ZoruButton>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ZoruStatCard
              label="Submitted"
              value={kpis.submitted.toLocaleString()}
              icon={<Send className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Pending approval"
              value={kpis.pending.toLocaleString()}
              icon={<Clock className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Approved"
              value={kpis.approved.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <ZoruStatCard
              label="Avg hrs / employee"
              value={`${kpis.avg}h`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          {filtered.length === 0 && !loading ? null : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <ZoruTable>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead>Employee</ZoruTableHead>
                    <ZoruTableHead>Week of</ZoruTableHead>
                    <ZoruTableHead>Week end</ZoruTableHead>
                    <ZoruTableHead className="text-right">Total</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead>Submitted at</ZoruTableHead>
                    <ZoruTableHead>Approver</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.map((r) => (
                    <ZoruTableRow
                      key={r._id}
                      className="border-zoru-line transition-colors"
                    >
                      <ZoruTableCell>
                        {r.user_id ? (
                          <Link
                            href={`/dashboard/crm/time-tracking/weekly-timesheets/${r._id}`}
                            className="hover:underline"
                          >
                            <EntityPickerChip
                              entity="user"
                              id={String(r.user_id)}
                              fallback="—"
                            />
                          </Link>
                        ) : (
                          <span className="text-[12px] text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {fmtDate(r.week_start_date)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {fmtDate(r.week_end_date)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                        {`${r.total_hours || 0}h ${String(r.total_minutes || 0).padStart(2, '0')}m`}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={r.status} tone={statusToTone(r.status)} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                        {fmtDateTime(r.submitted_at)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {r.approved_by ? (
                          <EntityPickerChip
                            entity="user"
                            id={String(r.approved_by)}
                            fallback="—"
                          />
                        ) : (
                          <span className="text-[12px] text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Actions"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/crm/time-tracking/weekly-timesheets/${r._id}`}
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                              </Link>
                            </ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem onClick={() => setEditTarget(r)}>
                              <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                            </ZoruDropdownMenuItem>
                            {r.status === 'draft' ? (
                              <ZoruDropdownMenuItem
                                onClick={() => handleSubmit(r._id)}
                              >
                                <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
                              </ZoruDropdownMenuItem>
                            ) : null}
                            {r.status === 'submitted' ? (
                              <ZoruDropdownMenuItem
                                onClick={() => handleApprove(r._id)}
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                              </ZoruDropdownMenuItem>
                            ) : null}
                            <ZoruDropdownMenuItem
                              onClick={() => setDeleteId(r._id)}
                              className="text-zoru-danger"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                            </ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))}
                </ZoruTableBody>
              </ZoruTable>
            </div>
          )}
        </div>
      </EntityListShell>

      <TimesheetDialog
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
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete this timesheet?"
        description={`This permanently removes the timesheet for ${deleteRow?.user_id ? String(deleteRow.user_id) : 'the selected employee'}.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

interface TimesheetDialogProps {
  open: boolean;
  initial?: Row;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

function TimesheetDialog({ open, initial, onOpenChange, onSaved }: TimesheetDialogProps) {
  const { toast } = useZoruToast();
  const [state, action] = useActionState(
    async (
      _prev: { message?: string; error?: string; id?: string } | null,
      formData: FormData,
    ) => {
      const res = await saveWeeklyTimesheet(_prev, formData);
      if (res.error) {
        toast({
          title: 'Save failed',
          description: res.error,
          variant: 'destructive',
        });
        return res;
      }
      toast({ title: initial?._id ? 'Timesheet updated' : 'Timesheet created' });
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
            {initial?._id ? 'Edit timesheet' : 'New timesheet'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Pick an employee and the week start/end. Hours are aggregated from
            the daily entries.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form action={action} className="space-y-3">
          {initial?._id ? (
            <input type="hidden" name="_id" defaultValue={initial._id} />
          ) : null}
          <div>
            <ZoruLabel>
              Employee <span className="text-zoru-danger-ink">*</span>
            </ZoruLabel>
            <EntityFormField
              entity="employee"
              name="user_id"
              initialId={initial?.user_id ? String(initial.user_id) : undefined}
              placeholder="Pick an employee"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="week_start_date">
                Week start <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="week_start_date"
                name="week_start_date"
                type="date"
                defaultValue={fmtDate(initial?.week_start_date)}
                required
              />
            </div>
            <div>
              <ZoruLabel htmlFor="week_end_date">
                Week end <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                id="week_end_date"
                name="week_end_date"
                type="date"
                defaultValue={fmtDate(initial?.week_end_date)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel htmlFor="total_hours">Total hours</ZoruLabel>
              <ZoruInput
                id="total_hours"
                name="total_hours"
                type="number"
                defaultValue={String(initial?.total_hours ?? 0)}
              />
            </div>
            <div>
              <ZoruLabel htmlFor="total_minutes">Total minutes</ZoruLabel>
              <ZoruInput
                id="total_minutes"
                name="total_minutes"
                type="number"
                defaultValue={String(initial?.total_minutes ?? 0)}
              />
            </div>
          </div>
          <div>
            <ZoruLabel htmlFor="status">Status</ZoruLabel>
            <ZoruSelect name="status" defaultValue={initial?.status ?? 'draft'}>
              <ZoruSelectTrigger id="status">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="submitted">Submitted</ZoruSelectItem>
                <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div>
            <ZoruLabel htmlFor="reason">Reason (if rejected)</ZoruLabel>
            <ZoruTextarea
              id="reason"
              name="reason"
              rows={2}
              defaultValue={initial?.reason ?? ''}
            />
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
              {initial?._id ? 'Save changes' : 'Create timesheet'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
