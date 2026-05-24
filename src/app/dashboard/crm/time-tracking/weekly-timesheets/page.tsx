'use client';

export const dynamic = 'force-dynamic';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Checkbox,
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
  Textarea,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { saveWeeklyTimesheet } from '@/app/actions/worksuite/time.actions';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';
import { useTimesheets, type Row } from './use-timesheets';

import { format, parseISO } from 'date-fns';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    const d = typeof v === 'string' ? parseISO(v) : new Date(v as any);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'yyyy-MM-dd');
  } catch {
    return '—';
  }
}

function fmtDateTime(v: unknown): string {
  if (!v) return '—';
  try {
    const d = typeof v === 'string' ? parseISO(v) : new Date(v as any);
    if (Number.isNaN(d.getTime())) return '—';
    return format(d, 'PPpp');
  } catch {
    return '—';
  }
}

function fmtHours(r: Row): string {
  return `${r.total_hours || 0}h ${String(r.total_minutes || 0).padStart(2, '0')}m`;
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-zoru-line">
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow className="border-zoru-line hover:bg-transparent">
            <ZoruTableHead className="w-10"><div className="h-4 w-4 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableHead>
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
          {[1, 2, 3, 4, 5].map((i) => (
            <ZoruTableRow key={i} className="border-zoru-line">
              <ZoruTableCell><div className="h-4 w-4 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-6 w-24 rounded-full bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-4 w-20 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-4 w-20 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell className="text-right"><div className="ml-auto h-4 w-12 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-5 w-16 rounded-full bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-4 w-24 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell><div className="h-6 w-24 rounded-full bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
              <ZoruTableCell className="text-right"><div className="ml-auto h-8 w-8 rounded bg-zoru-surface-2 animate-pulse" /></ZoruTableCell>
            </ZoruTableRow>
          ))}
        </ZoruTableBody>
      </Table>
    </div>
  );
}

export default function WeeklyTimesheetsPage() {
  const { toast } = useZoruToast();
  
  const {
    rows, loading, initialLoading, searchRaw, handleSearch,
    statusFilter, setStatusFilter, employeeFilter, setEmployeeFilter,
    fromDate, setFromDate, toDate, setToDate,
    hasMore, handleLoadMore, refresh,
    createOpen, setCreateOpen, editTarget, setEditTarget, deleteId, setDeleteId, deleteRow,
    selected, setSelected, bulkPending, bulkDeleteOpen, setBulkDeleteOpen,
    kpis, hasActiveFilters, clearFilters,
    allChecked, someChecked, toggleAll, toggleOne, selectedIds, hasSelection,
    handleConfirmDelete, handleSubmit, handleApprove, handleReject,
    handleBulkSubmit, handleBulkApprove, handleBulkReject, handleBulkDelete
  } = useTimesheets();

  const handleExportCsv = () => {
    const exportRows = rows.map((r) => ({
      'Employee ID': String(r.user_id ?? ''),
      'Week start': fmtDate(r.week_start_date),
      'Week end': fmtDate(r.week_end_date),
      'Total hours': Number(r.total_hours) || 0,
      'Total minutes': Number(r.total_minutes) || 0,
      Status: r.status || '',
      'Submitted at': fmtDateTime(r.submitted_at),
      'Approver ID': r.approved_by ? String(r.approved_by) : '',
    }));
    downloadCsv(`timesheets-${dateStamp()}.csv`, Object.keys(exportRows[0] ?? {}), exportRows);
    toast({ title: 'CSV exported' });
  };

  const handleExportXlsx = async () => {
    const exportRows = rows.map((r) => ({
      'Employee ID': String(r.user_id ?? ''),
      'Week start': fmtDate(r.week_start_date),
      'Week end': fmtDate(r.week_end_date),
      'Total hours': Number(r.total_hours) || 0,
      'Total minutes': Number(r.total_minutes) || 0,
      Status: r.status || '',
      'Submitted at': fmtDateTime(r.submitted_at),
      'Approver ID': r.approved_by ? String(r.approved_by) : '',
    }));
    await downloadXlsx(`timesheets-${dateStamp()}.xlsx`, Object.keys(exportRows[0] ?? {}), exportRows, 'Timesheets');
    toast({ title: 'XLSX exported' });
  };

  return (
    <>
      <EntityListShell
        title="Weekly Timesheets"
        subtitle="Per-employee weekly grids. Submit for review, then approve or reject."
        search={{
          value: searchRaw,
          onChange: handleSearch,
          placeholder: 'Search reason / notes…',
        }}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={rows.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportXlsx} disabled={rows.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> XLSX
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New timesheet
            </Button>
          </div>
        }
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[130px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="submitted">Submitted</ZoruSelectItem>
                <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Input
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              placeholder="Employee id"
              className="h-9 w-[160px] text-[13px]"
            />
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-zoru-ink-muted">From</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-[140px] text-[13px]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-zoru-ink-muted">To</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-[140px] text-[13px]"
              />
            </div>
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            ) : null}
          </>
        }
        empty={
          !initialLoading && rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <CalendarRange className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No timesheets yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted text-center">
                Create weekly timesheets to collect hours from your team and approve them in one place.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New timesheet
              </Button>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Submitted" value={kpis.submitted.toLocaleString()} icon={<Send className="h-4 w-4" />} />
            <StatCard label="Pending approval" value={kpis.pending.toLocaleString()} icon={<Clock className="h-4 w-4" />} />
            <StatCard label="Approved" value={kpis.approved.toLocaleString()} icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatCard label="Avg hrs / employee" value={`${kpis.avg}h`} icon={<TrendingUp className="h-4 w-4" />} />
          </div>

          {/* Bulk selection header */}
          {rows.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                <Checkbox
                  checked={allChecked}
                  aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Select all visible timesheets"
                />
                Select all
              </label>
            </div>
          )}

          {/* Bulk action bar */}
          {hasSelection && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
              <span className="font-medium text-foreground">{selectedIds.length} selected</span>
              <Button variant="outline" size="sm" disabled={bulkPending} onClick={handleBulkSubmit}>
                {bulkPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                Submit
              </Button>
              <Button variant="outline" size="sm" disabled={bulkPending} onClick={handleBulkApprove}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
              </Button>
              <Button variant="outline" size="sm" disabled={bulkPending} onClick={handleBulkReject}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
              </Button>
              <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <Button variant="destructive" size="sm" disabled={bulkPending} onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete selected
                </Button>
                <ZoruAlertDialogContent>
                  <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Delete {selectedIds.length} timesheet(s)?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                      This permanently removes the selected timesheets. This action cannot be undone.
                    </ZoruAlertDialogDescription>
                  </ZoruAlertDialogHeader>
                  <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
                      {bulkPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Delete
                    </ZoruAlertDialogAction>
                  </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
              </ZoruAlertDialog>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            </div>
          )}

          {initialLoading ? (
            <TableSkeleton />
          ) : rows.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                      <ZoruTableHead className="w-10">
                        <Checkbox
                          checked={allChecked}
                          aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                          disabled={rows.length === 0}
                        />
                      </ZoruTableHead>
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
                    {rows.map((r) => (
                      <ZoruTableRow key={r._id} className="border-zoru-line transition-colors">
                        <ZoruTableCell>
                          <Checkbox
                            checked={selected.has(r._id)}
                            onCheckedChange={() => toggleOne(r._id)}
                            aria-label={`Select timesheet for ${r.user_id}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {r.user_id ? (
                            <EntityRowLink
                              href={`/dashboard/crm/time-tracking/weekly-timesheets/${r._id}`}
                              label={<EntityPickerChip entity="user" id={String(r.user_id)} fallback="—" />}
                            />
                          ) : (
                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">{fmtDate(r.week_start_date)}</ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">{fmtDate(r.week_end_date)}</ZoruTableCell>
                        <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">{fmtHours(r)}</ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill label={r.status} tone={statusToTone(r.status)} />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">{fmtDateTime(r.submitted_at)}</ZoruTableCell>
                        <ZoruTableCell>
                          {r.approved_by ? (
                            <EntityPickerChip entity="user" id={String(r.approved_by)} fallback="—" />
                          ) : (
                            <span className="text-[12px] text-zoru-ink-muted">—</span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                              <button type="button" aria-label="Actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                              <ZoruDropdownMenuItem asChild>
                                <Link href={`/dashboard/crm/time-tracking/weekly-timesheets/${r._id}`}>
                                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem onClick={() => setEditTarget(r)}>
                                <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                              </ZoruDropdownMenuItem>
                              {r.status === 'draft' ? (
                                <ZoruDropdownMenuItem onClick={() => handleSubmit(r._id)}>
                                  <Send className="mr-1.5 h-3.5 w-3.5" /> Submit
                                </ZoruDropdownMenuItem>
                              ) : null}
                              {r.status === 'submitted' ? (
                                <>
                                  <ZoruDropdownMenuItem onClick={() => handleApprove(r._id)}>
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                                  </ZoruDropdownMenuItem>
                                  <ZoruDropdownMenuItem onClick={() => handleReject(r._id)}>
                                    <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                                  </ZoruDropdownMenuItem>
                                </>
                              ) : null}
                              <ZoruDropdownMenuItem onClick={() => setDeleteId(r._id)} className="text-zoru-danger">
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </DropdownMenu>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))}
                  </ZoruTableBody>
                </Table>
              </div>
              
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                    {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Load more
                  </Button>
                </div>
              )}
            </div>
          ) : null}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Label>
              Employee <span className="text-zoru-danger-ink">*</span>
            </Label>
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
              <Label htmlFor="week_start_date">
                Week start <span className="text-zoru-danger-ink">*</span>
              </Label>
              <Input
                id="week_start_date"
                name="week_start_date"
                type="date"
                defaultValue={fmtDate(initial?.week_start_date)}
                required
              />
            </div>
            <div>
              <Label htmlFor="week_end_date">
                Week end <span className="text-zoru-danger-ink">*</span>
              </Label>
              <Input
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
              <Label htmlFor="total_hours">Total hours</Label>
              <Input
                id="total_hours"
                name="total_hours"
                type="number"
                defaultValue={String(initial?.total_hours ?? 0)}
              />
            </div>
            <div>
              <Label htmlFor="total_minutes">Total minutes</Label>
              <Input
                id="total_minutes"
                name="total_minutes"
                type="number"
                defaultValue={String(initial?.total_minutes ?? 0)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={initial?.status ?? 'draft'}>
              <ZoruSelectTrigger id="status">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                <ZoruSelectItem value="submitted">Submitted</ZoruSelectItem>
                <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="reason">Reason (if rejected)</Label>
            <Textarea
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {initial?._id ? 'Save changes' : 'Create timesheet'}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
