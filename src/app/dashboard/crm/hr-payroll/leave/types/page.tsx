'use client';

/**
 * Leave Types — config list for leave categories.
 *
 * Multi-tenant via `getLeaveTypes` / `saveLeaveType` / `deleteLeaveType`.
 *
 * KPIs:
 *   - Total types
 *   - Accrual enabled (monthly_limit > 0 — drip-allocation per month)
 *   - Encashable (paid types — can be carried into payroll on exit)
 *
 * Toolbar: search, status filter, unit filter, paid filter, bulk-delete,
 * CSV / XLSX export, pagination.
 */

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruColorPicker,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  X,
  Download,
  FileSpreadsheet,
  Layers3,
  Repeat,
  BadgeDollarSign,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  getLeaveTypes,
  saveLeaveType,
  deleteLeaveType,
} from '@/app/actions/worksuite/leave.actions';
import type { WsLeaveType } from '@/lib/worksuite/leave-types';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

const PAGE_SIZE = 25;

export default function LeaveTypesPage() {
  const { toast } = useZoruToast();
  const [types, setTypes] = useState<(WsLeaveType & { _id: string })[]>([]);
  const [isLoadingList, startLoadList] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  // dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(WsLeaveType & { _id: string }) | null>(null);

  // controlled form fields
  const [typeName, setTypeName] = useState('');
  const [noOfLeaves, setNoOfLeaves] = useState('0');
  const [color, setColor] = useState('#EAB308');
  const [monthlyLimit, setMonthlyLimit] = useState('0');
  const [paid, setPaid] = useState('true');
  const [leaveUnit, setLeaveUnit] = useState<'days' | 'hours' | 'half-days'>('days');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const formRef = useRef<HTMLFormElement>(null);

  const [actionState, formAction, isPending] = useActionState(saveLeaveType, undefined);

  // Filters
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'days' | 'hours' | 'half-days'>('all');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadTypes = () => {
    startLoadList(async () => {
      const ts = await getLeaveTypes();
      setTypes(ts as (WsLeaveType & { _id: string })[]);
    });
  };

  useEffect(() => { loadTypes(); }, []);

  useEffect(() => {
    if (!actionState) return;
    if (actionState.error) {
      toast({ title: 'Error', description: actionState.error, variant: 'destructive' });
    } else if (actionState.message) {
      toast({ title: 'Saved', description: actionState.message });
      setOpen(false);
      loadTypes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionState]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return types.filter((t) => {
      if (needle && !t.type_name.toLowerCase().includes(needle)) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (unitFilter !== 'all' && t.leave_unit !== unitFilter) return false;
      if (paidFilter === 'paid' && !t.paid) return false;
      if (paidFilter === 'unpaid' && t.paid) return false;
      return true;
    });
  }, [types, q, statusFilter, unitFilter, paidFilter]);

  // KPIs (computed across full list, not filtered)
  const kpiTotal = types.length;
  const kpiAccrual = types.filter((t) => Number(t.monthly_limit) > 0).length;
  const kpiEncashable = types.filter((t) => t.paid && t.status === 'active').length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE),
    [filtered, pageSafe],
  );

  useEffect(() => {
    setPage(1);
  }, [q, statusFilter, unitFilter, paidFilter]);

  const openNew = () => {
    setEditing(null);
    setTypeName('');
    setNoOfLeaves('0');
    setColor('#EAB308');
    setMonthlyLimit('0');
    setPaid('true');
    setLeaveUnit('days');
    setStatus('active');
    setOpen(true);
  };

  const openEdit = (t: WsLeaveType & { _id: string }) => {
    setEditing(t);
    setTypeName(t.type_name);
    setNoOfLeaves(String(t.no_of_leaves));
    setColor(t.color || '#EAB308');
    setMonthlyLimit(String(t.monthly_limit));
    setPaid(t.paid ? 'true' : 'false');
    setLeaveUnit(t.leave_unit);
    setStatus(t.status);
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this leave type?')) return;
    startDelete(async () => {
      const r = await deleteLeaveType(id);
      if (r.success) {
        toast({ title: 'Deleted' });
        setSelected((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
        loadTypes();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Delete ${selected.size} leave type(s)?`)) return;
    startDelete(async () => {
      const ids = Array.from(selected);
      let failed = 0;
      for (const id of ids) {
        const r = await deleteLeaveType(id);
        if (!r.success) failed += 1;
      }
      if (failed === 0) toast({ title: 'Deleted', description: `${ids.length} type(s) removed` });
      else toast({ title: 'Partial failure', description: `${failed} failed`, variant: 'destructive' });
      setSelected(new Set());
      loadTypes();
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const t of pageRows) {
        if (checked) next.add(t._id);
        else next.delete(t._id);
      }
      return next;
    });
  };

  const buildExport = (): { headers: string[]; rows: ExportRow[] } => {
    const headers = [
      'Type',
      'Per Year',
      'Monthly Cap',
      'Unit',
      'Paid',
      'Color',
      'Status',
    ];
    const out: ExportRow[] = filtered.map((t) => ({
      Type: t.type_name,
      'Per Year': t.no_of_leaves,
      'Monthly Cap': t.monthly_limit,
      Unit: t.leave_unit,
      Paid: t.paid ? 'Yes' : 'No',
      Color: t.color,
      Status: t.status,
    }));
    return { headers, rows: out };
  };

  const onExportCsv = () => {
    const { headers, rows } = buildExport();
    downloadCsv(`leave-types-${dateStamp()}.csv`, headers, rows);
  };
  const onExportXlsx = () => {
    const { headers, rows } = buildExport();
    void downloadXlsx(`leave-types-${dateStamp()}.xlsx`, headers, rows, 'Leave Types');
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((t) => selected.has(t._id));

  return (
    <EntityListShell
      title="Leave Types"
      subtitle="Define leave categories with annual quota, color, monthly cap, and paid status."
      search={{ value: q, onChange: setQ, placeholder: 'Search types…' }}
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
          <ZoruButton onClick={openNew}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add Leave Type
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <div className="w-40">
            <ZoruSelect value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-40">
            <ZoruSelect value={unitFilter} onValueChange={(v) => setUnitFilter(v as typeof unitFilter)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Unit" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All units</ZoruSelectItem>
                <ZoruSelectItem value="days">Days</ZoruSelectItem>
                <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                <ZoruSelectItem value="half-days">Half-days</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-40">
            <ZoruSelect value={paidFilter} onValueChange={(v) => setPaidFilter(v as typeof paidFilter)}>
              <ZoruSelectTrigger>
                <ZoruSelectValue placeholder="Paid" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">Paid + Unpaid</ZoruSelectItem>
                <ZoruSelectItem value="paid">Paid only</ZoruSelectItem>
                <ZoruSelectItem value="unpaid">Unpaid only</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
        </>
      }
      bulkBar={
        selected.size > 0 ? (
          <ZoruCard className="flex items-center justify-between gap-3 px-4 py-2">
            <span className="text-[12.5px] text-zoru-ink-muted">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <ZoruButton variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </ZoruButton>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />
                Delete selected
              </ZoruButton>
            </div>
          </ZoruCard>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-3">
          <KpiCard
            icon={<Layers3 className="h-4 w-4" />}
            label="Total types"
            value={kpiTotal.toLocaleString('en-IN')}
            hint="Including inactive"
          />
          <KpiCard
            icon={<Repeat className="h-4 w-4" />}
            label="Accrual enabled"
            value={kpiAccrual.toLocaleString('en-IN')}
            hint="Types with monthly cap > 0"
          />
          <KpiCard
            icon={<BadgeDollarSign className="h-4 w-4" />}
            label="Encashable"
            value={kpiEncashable.toLocaleString('en-IN')}
            hint="Active paid types"
          />
        </div>

        <ZoruCard className="p-6">
          {isLoadingList && types.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-zoru-ink-muted">
              {types.length === 0
                ? 'No leave types yet. Add one above.'
                : 'No leave types match the current filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-3">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAllOnPage(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Type</th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Per Year</th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Monthly Cap</th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Unit</th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Paid</th>
                    <th className="px-4 py-3 font-medium text-zoru-ink-muted">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => {
                    const isSel = selected.has(t._id);
                    return (
                      <tr key={t._id} className="border-b border-zoru-line last:border-0">
                        <td className="px-3 py-3">
                          <ZoruCheckbox
                            checked={isSel}
                            onCheckedChange={(c) => {
                              setSelected((s) => {
                                const next = new Set(s);
                                if (c) next.add(t._id);
                                else next.delete(t._id);
                                return next;
                              });
                            }}
                            aria-label={`Select ${t.type_name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                              style={{ backgroundColor: t.color || '#94A3B8' }}
                            />
                            <EntityRowLink
                              href={`/dashboard/crm/hr-payroll/leave/types#${t._id}`}
                              label={t.type_name}
                              subtitle={t.paid ? 'Paid' : 'Unpaid'}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zoru-ink">{t.no_of_leaves}</td>
                        <td className="px-4 py-3 text-zoru-ink">{t.monthly_limit}</td>
                        <td className="px-4 py-3 capitalize text-zoru-ink">{t.leave_unit}</td>
                        <td className="px-4 py-3">
                          <ZoruBadge variant={t.paid ? 'success' : 'warning'}>
                            {t.paid ? 'Paid' : 'Unpaid'}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3">
                          <ZoruBadge variant={t.status === 'active' ? 'success' : 'warning'}>
                            {t.status}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => openEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                              Edit
                            </ZoruButton>
                            <ZoruButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(t._id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" strokeWidth={1.75} />
                              Delete
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
              <span>
                Page {pageSafe} of {totalPages} · {filtered.length} types
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

      {/* Add / Edit dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <ZoruCard className="w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] text-zoru-ink">
                {editing ? 'Edit Leave Type' : 'Add Leave Type'}
              </h2>
              <ZoruButton
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
                Close
              </ZoruButton>
            </div>

            <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
              {editing && (
                <input type="hidden" name="_id" value={editing._id} />
              )}

              <div className="md:col-span-2">
                <ZoruLabel className="text-zoru-ink">Type Name *</ZoruLabel>
                <ZoruInput
                  name="type_name"
                  required
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Leaves Per Year</ZoruLabel>
                <ZoruInput
                  name="no_of_leaves"
                  type="number"
                  min="0"
                  value={noOfLeaves}
                  onChange={(e) => setNoOfLeaves(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Monthly Limit</ZoruLabel>
                <ZoruInput
                  name="monthly_limit"
                  type="number"
                  min="0"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Color</ZoruLabel>
                <input type="hidden" name="color" value={color} />
                <div className="mt-1.5">
                  <ZoruColorPicker value={color} onChange={setColor} />
                </div>
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Leave Unit</ZoruLabel>
                <ZoruSelect
                  value={leaveUnit}
                  onValueChange={(v) => setLeaveUnit(v as typeof leaveUnit)}
                  name="leave_unit"
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="days">Days</ZoruSelectItem>
                    <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                    <ZoruSelectItem value="half-days">Half Days</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="leave_unit" value={leaveUnit} />
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Paid</ZoruLabel>
                <ZoruSelect value={paid} onValueChange={setPaid} name="paid">
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="true">Yes</ZoruSelectItem>
                    <ZoruSelectItem value="false">No</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="paid" value={paid} />
              </div>

              <div>
                <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
                <ZoruSelect
                  value={status}
                  onValueChange={(v) => setStatus(v as typeof status)}
                  name="status"
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
                <input type="hidden" name="status" value={status} />
              </div>

              <div className="flex justify-end gap-2 md:col-span-2">
                <ZoruButton
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </ZoruButton>
                <ZoruButton
                  type="submit"
                  disabled={isPending}
                >
                  {isPending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null}
                  {editing ? 'Update' : 'Create'}
                </ZoruButton>
              </div>
            </form>
          </ZoruCard>
        </div>
      )}
    </EntityListShell>
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
