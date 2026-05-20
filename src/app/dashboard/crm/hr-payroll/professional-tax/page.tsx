'use client';

/**
 * Professional Tax — deepened page.
 *
 * KPI strip: total employees applicable, total PT liability, states configured,
 *            avg PT per employee.
 * Filters: state filter (derived from report rows), search by employee name.
 * Export: CSV / XLSX of the filtered report.
 * Slabs panel: unchanged inline slab management.
 *
 * Multi-tenant: all server actions scope by userId server-side.
 */

import * as React from 'react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
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
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useFormStatus } from 'react-dom';
import {
  Download,
  Edit,
  FileSpreadsheet,
  IndianRupee,
  LoaderCircle,
  MapPin,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCrmPtSlabs,
  saveCrmPtSlab,
  deleteCrmPtSlab,
  generateProfessionalTaxReport,
} from '@/app/actions/crm-hr.actions';
import type { WithId, CrmProfessionalTaxSlab } from '@/lib/definitions';
import { indianStates } from '@/lib/states';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportRow = {
  employeeId: string;
  employeeName: string;
  state: string;
  grossSalary: number;
  taxAmount: number;
  designation?: string;
};

// ── Slab form ─────────────────────────────────────────────────────────────────

const SLAB_INITIAL: { message: null | string; error: null | string } = {
  message: null,
  error: null,
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {isEditing ? 'Save Slab' : 'Add Slab'}
    </ZoruButton>
  );
}

function SlabFormDialog({
  onSave,
  slab,
}: {
  onSave: () => void;
  slab?: WithId<CrmProfessionalTaxSlab> | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveCrmPtSlab, SLAB_INITIAL);
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Saved', description: state.message });
      onSave();
      setOpen(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSave]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        {slab ? (
          <ZoruButton variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </ZoruButton>
        ) : (
          <ZoruButton>
            <Plus className="h-4 w-4" /> Add New Slab
          </ZoruButton>
        )}
      </ZoruDialogTrigger>
      <ZoruDialogContent>
        <form action={formAction}>
          <input type="hidden" name="slabId" value={slab?._id.toString()} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {slab ? 'Edit' : 'Add'} Professional Tax Slab
            </ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <ZoruLabel>
                State <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruSelect name="state" required defaultValue={slab?.state}>
                <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                  <ZoruSelectValue placeholder="Select a state…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent className="max-h-60">
                  {indianStates.map((s) => (
                    <ZoruSelectItem key={s} value={s}>
                      {s}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <ZoruLabel>
                  Min. Monthly Salary (₹){' '}
                  <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  type="number"
                  name="minSalary"
                  defaultValue={slab?.minSalary}
                  required
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel>
                  Max. Monthly Salary (₹){' '}
                  <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  type="number"
                  name="maxSalary"
                  defaultValue={slab?.maxSalary}
                  required
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <ZoruLabel>
                Monthly Tax Amount (₹) <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                type="number"
                name="taxAmount"
                defaultValue={slab?.taxAmount}
                required
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </ZoruButton>
            <SubmitButton isEditing={!!slab} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function DeleteSlabButton({
  slabId,
  onDeleted,
}: {
  slabId: string;
  onDeleted: () => void;
}) {
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCrmPtSlab(slabId);
      if (result.success) {
        toast({ title: 'Deleted' });
        onDeleted();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton
          variant="ghost"
          size="icon"
          className="text-zoru-danger-ink hover:text-zoru-danger-ink"
        >
          <Trash2 className="h-4 w-4" />
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Delete Slab?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            Are you sure? This cannot be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function ProfessionalTaxPage() {
  const [slabs, setSlabs] = useState<WithId<CrmProfessionalTaxSlab>[]>([]);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [isLoading, startLoading] = useTransition();

  // Filters.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const fetchData = useCallback(() => {
    startLoading(async () => {
      const [slabsData, reportData] = await Promise.all([
        getCrmPtSlabs(),
        generateProfessionalTaxReport(),
      ]);
      setSlabs(slabsData);
      setReport(reportData as ReportRow[]);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debouncedSearch = useDebouncedCallback((v: string) => {
    setSearch(v);
  }, 300);

  // Derived data.
  const states = useMemo(() => {
    const set = new Set<string>();
    for (const r of report) if (r.state && r.state !== 'N/A') set.add(r.state);
    return Array.from(set).sort();
  }, [report]);

  const filteredReport = useMemo(() => {
    const q = search.trim().toLowerCase();
    return report.filter((r) => {
      if (stateFilter !== 'all' && r.state !== stateFilter) return false;
      if (q && !r.employeeName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [report, search, stateFilter]);

  // KPIs (over full report).
  const kpis = useMemo(() => {
    const totalEmployees = filteredReport.length;
    const totalPT = filteredReport.reduce((s, r) => s + (r.taxAmount ?? 0), 0);
    const statesCount = new Set(slabs.map((s) => s.state)).size;
    const avgPT = totalEmployees > 0 ? totalPT / totalEmployees : 0;
    return { totalEmployees, totalPT, statesCount, avgPT };
  }, [filteredReport, slabs]);

  // Summary KPIs (based on full slabs list for states config).
  const totalSlabPT = report.reduce((s, r) => s + (r.taxAmount ?? 0), 0);
  const configuredStates = [...new Set(slabs.map((s) => s.state))].length;

  // Export.
  const buildExport = useCallback((): { headers: string[]; rows: ExportRow[] } => {
    const headers = ['Employee', 'State', 'Gross Salary (₹)', 'Professional Tax (₹)'];
    const rows: ExportRow[] = filteredReport.map((r) => ({
      Employee: r.employeeName,
      State: r.state,
      'Gross Salary (₹)': r.grossSalary,
      'Professional Tax (₹)': r.taxAmount,
    }));
    return { headers, rows };
  }, [filteredReport]);

  const onExportCsv = useCallback(() => {
    const { headers, rows } = buildExport();
    downloadCsv(`professional-tax-${dateStamp()}.csv`, headers, rows);
  }, [buildExport]);

  const onExportXlsx = useCallback(() => {
    const { headers, rows } = buildExport();
    void downloadXlsx(
      `professional-tax-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Professional Tax',
    );
  }, [buildExport]);

  const hasActiveFilters = !!search || stateFilter !== 'all';

  const clearFilters = useCallback(() => {
    setSearch('');
    setSearchInput('');
    setStateFilter('all');
  }, []);

  return (
    <EntityListShell
      title="Professional Tax"
      subtitle="Manage state-wise PT slabs and view calculated tax for employees."
      search={{
        value: searchInput,
        onChange: (v) => {
          setSearchInput(v);
          debouncedSearch(v);
        },
        placeholder: 'Search employee…',
      }}
      primaryAction={
        <div className="flex flex-wrap items-center gap-2">
          <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </ZoruButton>
          <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
          </ZoruButton>
        </div>
      }
      filters={
        <>
          <ZoruSelect
            value={stateFilter}
            onValueChange={(v) => setStateFilter(v)}
          >
            <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
              <ZoruSelectValue placeholder="State" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All states</ZoruSelectItem>
              {states.map((s) => (
                <ZoruSelectItem key={s} value={s}>
                  {s}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
          {hasActiveFilters ? (
            <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </ZoruButton>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Employees applicable"
            value={kpis.totalEmployees.toLocaleString('en-IN')}
            hint={stateFilter !== 'all' ? `Filtered by ${stateFilter}` : 'With matching state slab'}
          />
          <KpiCard
            icon={<IndianRupee className="h-4 w-4" />}
            label="Total PT liability"
            value={INR.format(kpis.totalPT)}
            hint="Current month · filtered view"
          />
          <KpiCard
            icon={<MapPin className="h-4 w-4" />}
            label="States configured"
            value={configuredStates.toLocaleString('en-IN')}
            hint={`${slabs.length} slab${slabs.length !== 1 ? 's' : ''} defined`}
          />
          <KpiCard
            icon={<IndianRupee className="h-4 w-4" />}
            label="Avg PT / employee"
            value={INR.format(Math.round(kpis.avgPT))}
            hint="Based on filtered employees"
          />
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* PT Report table — 2 columns wide */}
          <div className="lg:col-span-2">
            <ZoruCard className="p-6">
              <div className="mb-4">
                <h2 className="text-[16px] text-zoru-ink">Professional Tax Report</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                  {filteredReport.length} employee{filteredReport.length !== 1 ? 's' : ''}
                  {hasActiveFilters ? ' (filtered)' : ' applicable'}.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-zoru-line">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-zoru-line bg-zoru-surface-2">
                      <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Employee</th>
                      <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">State</th>
                      <th className="px-4 py-3 text-right text-[12px] text-zoru-ink-muted">
                        Gross Salary
                      </th>
                      <th className="px-4 py-3 text-right text-[12px] text-zoru-ink-muted">
                        PT (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="h-48 text-center">
                          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                        </td>
                      </tr>
                    ) : filteredReport.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="h-24 text-center text-[13px] text-zoru-ink-muted"
                        >
                          {hasActiveFilters
                            ? 'No employees match the current filters.'
                            : 'No data. Add employees with salary and state, then define slabs.'}
                        </td>
                      </tr>
                    ) : (
                      filteredReport.map((item, idx) => (
                        <tr
                          key={item.employeeId ?? idx}
                          className="border-b border-zoru-line last:border-0 transition-colors hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-zoru-ink">
                              {item.employeeName}
                            </div>
                            {item.designation ? (
                              <div className="text-[11.5px] text-zoru-ink-muted">
                                {item.designation}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <ZoruBadge variant="secondary">{item.state}</ZoruBadge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                            {INR.format(item.grossSalary)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-zoru-ink">
                            {INR.format(item.taxAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredReport.length > 0 ? (
                    <tfoot>
                      <tr className="border-t-2 border-zoru-line bg-zoru-surface-2">
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-[12.5px] text-zoru-ink"
                        >
                          Total PT
                          {hasActiveFilters ? ' (filtered)' : ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[12.5px] text-zoru-ink">
                          {INR.format(kpis.totalPT)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </ZoruCard>
          </div>

          {/* Slabs panel */}
          <div className="lg:col-span-1">
            <ZoruCard className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] text-zoru-ink">Tax Slabs</h2>
                  <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                    State-wise salary bands
                  </p>
                </div>
                <SlabFormDialog onSave={fetchData} />
              </div>

              {isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <LoaderCircle className="h-6 w-6 animate-spin text-zoru-ink-muted" />
                </div>
              ) : slabs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zoru-line p-6 text-center text-[12.5px] text-zoru-ink-muted">
                  No slabs configured. Click &ldquo;Add New Slab&rdquo; to start.
                </div>
              ) : (
                <div className="space-y-2">
                  {slabs.map((slab) => (
                    <div
                      key={slab._id.toString()}
                      className="flex items-start justify-between rounded-lg border border-zoru-line bg-zoru-surface-2 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <ZoruBadge variant="secondary">{slab.state}</ZoruBadge>
                        </div>
                        <p className="mt-1.5 text-[12px] text-zoru-ink-muted">
                          ₹{slab.minSalary.toLocaleString('en-IN')} –{' '}
                          ₹{slab.maxSalary.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[13px] text-zoru-ink">
                          ₹{slab.taxAmount.toLocaleString('en-IN')}
                          <span className="text-[11.5px] font-normal text-zoru-ink-muted">
                            /month
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <SlabFormDialog slab={slab} onSave={fetchData} />
                        <DeleteSlabButton
                          slabId={slab._id.toString()}
                          onDeleted={fetchData}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ZoruCard>
          </div>
        </div>
      </div>
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
      <div className="mt-2 truncate text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </ZoruCard>
  );
}
