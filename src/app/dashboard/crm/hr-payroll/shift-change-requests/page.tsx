'use client';

/**
 * Shift Change Requests — Deep list with KPIs, filters, bulk actions,
 * export, and pagination.
 *
 * Multi-tenant: every server action (`getShiftChangeRequests`,
 * `approveShiftChange`, `rejectShiftChange`, `saveShiftChangeRequest`,
 * `getEmployeeShifts`, `getCrmEmployees`) is tenant-scoped server-side.
 *
 * KPIs:
 *   - Total requests
 *   - Pending
 *   - Approved this week
 *   - Rejected this month
 *
 * Toolbar: search (employee), status filter, date-range filter,
 * bulk approve / reject, CSV / XLSX export, pagination.
 */

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  Check,
  Plus,
  X,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ListChecks,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { format } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WithId, CrmEmployee } from '@/lib/definitions';
import {
  getShiftChangeRequests,
  approveShiftChange,
  rejectShiftChange,
  saveShiftChangeRequest,
  getEmployeeShifts,
} from '@/app/actions/worksuite/shifts.actions';
import type {
  WsEmployeeShiftChangeRequest,
  WsEmployeeShift,
  WsShiftChangeStatus,
} from '@/lib/worksuite/shifts-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

type StatusFilter = 'all' | WsShiftChangeStatus;

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function ShiftChangeRequestsPage() {
  const [requests, setRequests] = useState<WsEmployeeShiftChangeRequest[]>([]);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [shifts, setShifts] = useState<WsEmployeeShift[]>([]);
  const [pending, startTransition] = useTransition();

  // Filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Selection (only pending rows are selectable for bulk action)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // New request dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newCurrentShiftId, setNewCurrentShiftId] = useState('');
  const [newRequestedShiftId, setNewRequestedShiftId] = useState('');
  const [newReason, setNewReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = () =>
    startTransition(async () => {
      const [reqs, emps, sh] = await Promise.all([
        getShiftChangeRequests(),
        getCrmEmployees(),
        getEmployeeShifts(),
      ]);
      setRequests(reqs);
      setEmployees(emps);
      setShifts(sh);
    });

  useEffect(() => {
    load();
  }, []);

  const empMap = useMemo(() => {
    const m = new Map<string, WithId<CrmEmployee>>();
    for (const e of employees) m.set(e._id.toString(), e);
    return m;
  }, [employees]);

  const shiftMap = useMemo(() => {
    const m = new Map<string, WsEmployeeShift>();
    for (const s of shifts) if (s._id) m.set(String(s._id), s);
    return m;
  }, [shifts]);

  const empLabel = (id: string) => {
    const e = empMap.get(id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() + 86399999 : null;
    return requests.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (needle) {
        const label = empLabel(r.user_id).toLowerCase();
        if (!label.includes(needle)) return false;
      }
      const ts = new Date(r.date).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, q, statusFilter, fromDate, toDate, empMap]);

  // KPIs (computed on full requests list — KPIs reflect system state)
  const now = new Date();
  const weekStartTs = startOfWeek(now).getTime();
  const monthStartTs = startOfMonth(now).getTime();

  const kpiTotal = requests.length;
  const kpiPending = requests.filter((r) => r.status === 'pending').length;
  const kpiApprovedThisWeek = requests.filter((r) => {
    if (r.status !== 'approved') return false;
    const ts = new Date(r.approved_at ?? r.updatedAt ?? r.date).getTime();
    return ts >= weekStartTs;
  }).length;
  const kpiRejectedThisMonth = requests.filter((r) => {
    if (r.status !== 'rejected') return false;
    const ts = new Date(r.approved_at ?? r.updatedAt ?? r.date).getTime();
    return ts >= monthStartTs;
  }).length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, fromDate, toDate]);

  const handleApprove = (id?: string) => {
    if (!id) return;
    startTransition(async () => {
      await approveShiftChange(id);
      load();
    });
  };

  const handleReject = (id?: string) => {
    if (!id) return;
    const reason = prompt('Reason for rejection (optional):', '') ?? '';
    startTransition(async () => {
      await rejectShiftChange(id, reason);
      load();
    });
  };

  const handleBulkApprove = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Approve ${selected.size} pending request(s)?`)) return;
    startTransition(async () => {
      for (const id of selected) {
        await approveShiftChange(id);
      }
      setSelected(new Set());
      load();
    });
  };

  const handleBulkReject = () => {
    if (selected.size === 0) return;
    const reason = prompt('Reject reason (applied to all):', '') ?? '';
    startTransition(async () => {
      for (const id of selected) {
        await rejectShiftChange(id, reason);
      }
      setSelected(new Set());
      load();
    });
  };

  const togglePageSelection = (checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageRows) {
        if (r.status !== 'pending' || !r._id) continue;
        if (checked) next.add(r._id);
        else next.delete(r._id);
      }
      return next;
    });
  };

  const buildExport = (): { headers: string[]; rows: ExportRow[] } => {
    const headers = [
      'Employee',
      'Date',
      'Current Shift',
      'Requested Shift',
      'Reason',
      'Status',
      'Created At',
      'Approved At',
    ];
    const rows: ExportRow[] = filtered.map((r) => ({
      Employee: empLabel(r.user_id),
      Date: format(new Date(r.date), 'yyyy-MM-dd'),
      'Current Shift': shiftMap.get(r.current_shift_id)?.name ?? r.current_shift_id,
      'Requested Shift': shiftMap.get(r.requested_shift_id)?.name ?? r.requested_shift_id,
      Reason: r.reason ?? '',
      Status: r.status,
      'Created At': r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm') : '',
      'Approved At': r.approved_at
        ? format(new Date(r.approved_at), 'yyyy-MM-dd HH:mm')
        : '',
    }));
    return { headers, rows };
  };
  const onExportCsv = () => {
    const { headers, rows } = buildExport();
    downloadCsv(`shift-change-requests-${dateStamp()}.csv`, headers, rows);
  };
  const onExportXlsx = () => {
    const { headers, rows } = buildExport();
    void downloadXlsx(
      `shift-change-requests-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Shift Changes',
    );
  };

  const resetForm = () => {
    setNewUserId('');
    setNewDate('');
    setNewCurrentShiftId('');
    setNewRequestedShiftId('');
    setNewReason('');
    setFormError(null);
  };

  const handleCreateRequest = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUserId || !newDate || !newCurrentShiftId || !newRequestedShiftId) {
      setFormError('Employee, date, current shift and requested shift are all required.');
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const res = await saveShiftChangeRequest({
        user_id: newUserId,
        date: new Date(newDate),
        current_shift_id: newCurrentShiftId,
        requested_shift_id: newRequestedShiftId,
        reason: newReason,
        status: 'pending',
      });
      if (!res.success) {
        setFormError(res.error ?? 'Failed to create request');
        return;
      }
      setDialogOpen(false);
      resetForm();
      load();
    });
  };

  const variant = (s: WsShiftChangeStatus): 'warning' | 'success' | 'danger' => {
    if (s === 'approved') return 'success';
    if (s === 'rejected') return 'danger';
    return 'warning';
  };

  const pendingPageRowIds = pageRows
    .filter((r) => r.status === 'pending' && r._id)
    .map((r) => r._id as string);
  const allPendingPageSelected =
    pendingPageRowIds.length > 0 &&
    pendingPageRowIds.every((id) => selected.has(id));

  return (
    <EntityListShell
      title="Shift Change Requests"
      subtitle="Review and action employee requests to swap shifts."
      search={{ value: q, onChange: setQ, placeholder: 'Search by employee…' }}
      primaryAction={
        <div className="flex items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
            XLSX
          </ZoruButton>
          <ZoruButton
            onClick={() => { resetForm(); setDialogOpen(true); }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            New Request
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="flex items-center gap-1">
            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">From</ZoruLabel>
            <ZoruInput
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div className="flex items-center gap-1">
            <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">To</ZoruLabel>
            <ZoruInput
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          {(q || statusFilter !== 'all' || fromDate || toDate) ? (
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => {
                setQ('');
                setStatusFilter('all');
                setFromDate('');
                setToDate('');
              }}
            >
              Clear filters
            </ZoruButton>
          ) : null}
        </>
      }
      bulkBar={
        selected.size > 0 ? (
          <ZoruCard className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-[12.5px] text-zoru-ink-muted">
              {selected.size} pending selected
            </span>
            <div className="flex items-center gap-2">
              <ZoruButton variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={handleBulkReject}
                disabled={pending}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                Reject selected
              </ZoruButton>
              <ZoruButton size="sm" onClick={handleBulkApprove} disabled={pending}>
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                Approve selected
              </ZoruButton>
            </div>
          </ZoruCard>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<ListChecks className="h-4 w-4" />}
            label="Total requests"
            value={kpiTotal.toLocaleString('en-IN')}
            hint="All-time"
          />
          <KpiCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Pending"
            value={kpiPending.toLocaleString('en-IN')}
            hint="Awaiting action"
          />
          <KpiCard
            icon={<CalendarRange className="h-4 w-4" />}
            label="Approved this week"
            value={kpiApprovedThisWeek.toLocaleString('en-IN')}
            hint={`Since ${format(startOfWeek(now), 'PP')}`}
          />
          <KpiCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Rejected this month"
            value={kpiRejectedThisMonth.toLocaleString('en-IN')}
            hint={format(now, 'MMMM yyyy')}
          />
        </div>

        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">All Requests</h2>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="w-10 px-3 py-2.5">
                    <ZoruCheckbox
                      checked={allPendingPageSelected}
                      onCheckedChange={(c) => togglePageSelection(Boolean(c))}
                      aria-label="Select all pending on page"
                      disabled={pendingPageRowIds.length === 0}
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Employee</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Date</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Current Shift</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Requested Shift</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Reason</th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">Status</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending && requests.length === 0 ? (
                  <tr className="border-b border-zoru-line">
                    <td colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                      Loading…
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((r) => {
                    const emp = empMap.get(r.user_id);
                    const cur = shiftMap.get(r.current_shift_id);
                    const req = shiftMap.get(r.requested_shift_id);
                    const isPending = r.status === 'pending';
                    const isSel = r._id ? selected.has(r._id) : false;
                    return (
                      <tr
                        key={String(r._id)}
                        className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50"
                      >
                        <td className="px-3 py-2.5">
                          <ZoruCheckbox
                            checked={isSel}
                            disabled={!isPending}
                            onCheckedChange={(c) => {
                              if (!r._id) return;
                              setSelected((s) => {
                                const next = new Set(s);
                                if (c) next.add(r._id as string);
                                else next.delete(r._id as string);
                                return next;
                              });
                            }}
                            aria-label="Select row"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-zoru-ink">
                          {emp ? (
                            <EntityRowLink
                              href={`/dashboard/crm/hr-payroll/employees/${r.user_id}`}
                              label={`${emp.firstName} ${emp.lastName}`}
                              subtitle={emp.employeeId}
                            />
                          ) : (
                            <span>{r.user_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-zoru-ink">
                          {format(new Date(r.date), 'PP')}
                        </td>
                        <td className="px-4 py-2.5">
                          <ShiftCell shift={cur} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ShiftCell shift={req} />
                        </td>
                        <td className="max-w-[240px] truncate px-4 py-2.5 text-[12.5px] text-zoru-ink-muted">
                          {r.reason || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <ZoruBadge variant={variant(r.status)}>{r.status}</ZoruBadge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-2">
                              <ZoruButton
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(r._id)}
                              >
                                <Check className="h-3.5 w-3.5" strokeWidth={2} />
                                Approve
                              </ZoruButton>
                              <ZoruButton
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(r._id)}
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2} />
                                Reject
                              </ZoruButton>
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-zoru-ink-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-b border-zoru-line">
                    <td colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                      {requests.length === 0
                        ? 'No shift change requests.'
                        : 'No requests match the current filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
              <span>
                Page {pageSafe} of {totalPages} · {filtered.length} request(s)
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  disabled={pageSafe >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </ZoruButton>
              </div>
            </div>
          ) : null}
        </ZoruCard>
      </div>

      <ZoruDialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <ZoruDialogContent className="sm:max-w-[520px]">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New Shift Change Request</ZoruDialogTitle>
          </ZoruDialogHeader>
          <form onSubmit={handleCreateRequest} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Employee <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruSelect value={newUserId} onValueChange={setNewUserId}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select employee" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {employees.map((e) => (
                    <ZoruSelectItem key={e._id.toString()} value={e._id.toString()}>
                      {e.firstName} {e.lastName}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Date <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Current Shift <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect value={newCurrentShiftId} onValueChange={setNewCurrentShiftId}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Current" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {shifts.map((s) => (
                      <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>

              <div className="flex flex-col gap-1.5">
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Requested Shift <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect value={newRequestedShiftId} onValueChange={setNewRequestedShiftId}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Requested" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {shifts.map((s) => (
                      <ZoruSelectItem key={String(s._id)} value={String(s._id)}>
                        {s.name}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">Reason (optional)</ZoruLabel>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={3}
                placeholder="Explain the reason for the shift change…"
                className="w-full resize-none rounded-lg border border-zoru-line bg-zoru-bg px-3 py-2 text-[13px] text-zoru-ink placeholder:text-zoru-ink-muted focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {formError ? (
              <div className="rounded-lg border border-rose-50 bg-rose-50/50 px-3 py-2 text-[13px] text-zoru-danger-ink">
                {formError}
              </div>
            ) : null}

            <ZoruDialogFooter>
              <ZoruButton
                variant="outline"
                type="button"
                onClick={() => { setDialogOpen(false); resetForm(); }}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Submit Request'}
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>
    </EntityListShell>
  );
}

function ShiftCell({ shift }: { shift?: WsEmployeeShift }) {
  if (!shift)
    return <span className="text-[12.5px] text-zoru-ink-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-zoru-ink">
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-[3px] border border-zoru-line"
        style={{ backgroundColor: shift.color_code || '#EAB308' }}
      />
      {shift.name}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 truncate text-[11.5px] text-zoru-ink-muted" title={hint}>
          {hint}
        </p>
      ) : null}
    </ZoruCard>
  );
}
