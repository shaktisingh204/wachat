'use client';

/**
 * HR / Travel Requests — Deep list page (§1D template).
 *
 * KPIs: total trips, pending approval, total spend MTD, top destination.
 * Filters: search · status · destination · from-date range.
 * Bulk: approve · reject · complete · archive · delete · export CSV/XLSX.
 * Multi-tenant via getSession in hr.actions / hrList.
 */

import * as React from 'react';
import { Plane } from 'lucide-react';

import { HrListShell, HrDateCell, HrStatusCell, type HrExportColumn } from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
  type DeepExportColumn,
  type SelectOption,
} from '../_components/hr-deep-list-body';
import { useZoruToast } from '@/components/zoruui';
import {
  bulkApproveTravelRequests,
  bulkCompleteTravelRequests,
  bulkDeleteTravelRequests,
  bulkRejectTravelRequests,
  deleteTravelRequest,
  getTravelRequestKpis,
  getTravelRequests,
  type HrTravelRequestKpis,
} from '@/app/actions/hr.actions';

interface TravelRow {
  _id: string;
  destination?: string;
  employeeId?: string;
  purpose?: string;
  fromDate?: string | Date;
  toDate?: string | Date;
  estimatedCost?: number;
  currency?: string;
  mode?: string;
  status?: string;
  notes?: string;
}

const BASE = '/dashboard/crm/hr/travel';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_KPIS: HrTravelRequestKpis = {
  total: 0,
  pendingApproval: 0,
  totalSpendMtd: 0,
  approved: 0,
  topDestination: null,
};

function getRowId(r: TravelRow): string {
  return String(r._id ?? '');
}

function getRowStatus(r: TravelRow): string {
  return String(r.status ?? 'pending');
}

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n.toLocaleString()} ${currency || ''}`.trim();
  }
}

function inDateRange(value: unknown, from: string, to: string): boolean {
  if (!from && !to) return true;
  if (!value) return false;
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return false;
  if (from) {
    const f = new Date(from);
    if (!Number.isNaN(f.getTime()) && d < f) return false;
  }
  if (to) {
    const t = new Date(to);
    if (!Number.isNaN(t.getTime())) {
      const end = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
      if (d > end) return false;
    }
  }
  return true;
}

export default function TravelPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<TravelRow[]>([]);
  const [kpis, setKpis] = React.useState<HrTravelRequestKpis>(EMPTY_KPIS);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [destination, setDestination] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([
        getTravelRequests(),
        getTravelRequestKpis(),
      ]);
      setRows((list ?? []) as unknown as TravelRow[]);
      setKpis(k ?? EMPTY_KPIS);
    } catch {
      setRows([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const destinationOptions: SelectOption[] = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = String(r.destination ?? '').trim();
      if (v) set.add(v);
    }
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (destination !== 'all' && String(r.destination ?? '') !== destination) return false;
      if (!inDateRange(r.fromDate, dateFrom, dateTo)) return false;
      if (!q) return true;
      const hay = `${r.destination ?? ''} ${r.purpose ?? ''} ${r.employeeId ?? ''} ${r.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, destination, dateFrom, dateTo, search]);

  const columns: DeepColumn<TravelRow>[] = [
    {
      key: 'destination',
      label: 'Destination',
      render: (r) => r.destination || '—',
    },
    {
      key: 'employeeId',
      label: 'Employee',
      render: (r) => r.employeeId || '—',
    },
    {
      key: 'fromDate',
      label: 'From',
      render: (r) => <HrDateCell value={r.fromDate} />,
    },
    {
      key: 'toDate',
      label: 'To',
      render: (r) => <HrDateCell value={r.toDate} />,
    },
    {
      key: 'estimatedCost',
      label: 'Est. cost',
      numeric: true,
      render: (r) =>
        r.estimatedCost
          ? fmtMoney(Number(r.estimatedCost) || 0, r.currency ?? '')
          : '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <HrStatusCell value={getRowStatus(r)} />,
    },
  ];

  const EXPORT_COLS: HrExportColumn<TravelRow>[] = [
    { label: 'Destination', value: (r) => r.destination ?? '' },
    { label: 'Employee', value: (r) => r.employeeId ?? '' },
    { label: 'Purpose', value: (r) => r.purpose ?? '' },
    {
      label: 'From Date',
      value: (r) =>
        r.fromDate ? new Date(r.fromDate as string).toISOString().slice(0, 10) : '',
    },
    {
      label: 'To Date',
      value: (r) =>
        r.toDate ? new Date(r.toDate as string).toISOString().slice(0, 10) : '',
    },
    { label: 'Mode', value: (r) => r.mode ?? '' },
    { label: 'Est. Cost', value: (r) => Number(r.estimatedCost) || 0 },
    { label: 'Currency', value: (r) => r.currency ?? '' },
    { label: 'Status', value: (r) => getRowStatus(r) },
  ];

  const exportColumns: DeepExportColumn<TravelRow>[] = [
    { header: 'Destination', value: (r) => r.destination ?? '' },
    { header: 'Employee', value: (r) => r.employeeId ?? '' },
    { header: 'Purpose', value: (r) => r.purpose ?? '' },
    {
      header: 'FromDate',
      value: (r) =>
        r.fromDate ? new Date(r.fromDate as string).toISOString() : '',
    },
    {
      header: 'ToDate',
      value: (r) => (r.toDate ? new Date(r.toDate as string).toISOString() : ''),
    },
    { header: 'Mode', value: (r) => r.mode ?? '' },
    { header: 'EstimatedCost', value: (r) => Number(r.estimatedCost) || 0 },
    { header: 'Currency', value: (r) => r.currency ?? '' },
    { header: 'Status', value: (r) => getRowStatus(r) },
  ];

  const handleApprove = React.useCallback(
    async (ids: string[]) => {
      const res = await bulkApproveTravelRequests(ids);
      return { success: res.success, notified: res.updated, error: res.error };
    },
    [],
  );

  const handleReject = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const res = await bulkRejectTravelRequests(ids);
      if (res.success) {
        toast({ title: `Rejected ${res.updated} request${res.updated === 1 ? '' : 's'}` });
        await refresh();
      } else {
        toast({
          title: 'Reject failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, refresh],
  );

  const handleComplete = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const res = await bulkCompleteTravelRequests(ids);
      if (res.success) {
        toast({
          title: `Completed ${res.updated} trip${res.updated === 1 ? '' : 's'}`,
        });
        await refresh();
      } else {
        toast({
          title: 'Complete failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, refresh],
  );

  return (
    <HrListShell<TravelRow>
      title="Travel Requests"
      subtitle="Business trip requests and approvals."
      icon={Plane}
      newHref={`${BASE}/new`}
      editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
      detailHref={(r) => `${BASE}/${getRowId(r)}`}
      columns={columns}
      rows={filtered}
      loading={loading}
      getRowId={getRowId}
      getRowStatus={getRowStatus}
      statusOptions={STATUS_OPTIONS}
      searchPredicate={() => true}
      searchPlaceholder="Search by destination, employee, purpose…"
      kpis={[
        { label: 'Total trips', value: kpis.total.toLocaleString() },
        {
          label: 'Pending approval',
          value: kpis.pendingApproval.toLocaleString(),
          tone: kpis.pendingApproval > 0 ? 'amber' : 'neutral',
        },
        {
          label: 'Spend MTD',
          value: fmtMoney(kpis.totalSpendMtd, 'INR'),
          tone: 'blue',
        },
        {
          label: 'Top destination',
          value: kpis.topDestination ? kpis.topDestination.destination : '—',
          hint: kpis.topDestination
            ? `${kpis.topDestination.count} trip${kpis.topDestination.count === 1 ? '' : 's'}`
            : undefined,
        },
      ]}
      exportColumns={EXPORT_COLS}
      exportBaseName="travel-requests"
      onDelete={async (id) => {
        const res = await deleteTravelRequest(id);
        return { success: !!res?.success, error: res?.error };
      }}
      onAfterChange={refresh}
    >
      <HrDeepListBody<TravelRow>
        rows={filtered}
        columns={columns}
        getRowId={getRowId}
        detailHref={(r) => `${BASE}/${getRowId(r)}`}
        editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
        onDeleteOne={async (id) => {
          const res = await deleteTravelRequest(id);
          return { success: !!res?.success, error: res?.error };
        }}
        onBulkDelete={async (ids) => {
          const res = await bulkDeleteTravelRequests(ids);
          return { success: res.success, deleted: res.deleted, error: res.error };
        }}
        onBulkArchive={async (ids) => {
          // Reject acts as the "archive" semantic for travel requests.
          await handleReject(ids);
          return { success: true, archived: ids.length };
        }}
        onBulkReminder={handleApprove}
        reminderLabel="Approve"
        onAfterChange={refresh}
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search by destination, employee, purpose…"
        cycleOptions={destinationOptions}
        cycle={destination}
        setCycle={setDestination}
        cycleLabel="Destination"
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        exportColumns={exportColumns}
        exportName="travel-requests"
        emptyText="No travel requests match this filter."
        beforeTable={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zoru-ink-muted">
            <span>
              Approved trips:{' '}
              <span className="font-medium text-zoru-ink">
                {kpis.approved.toLocaleString()}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void handleComplete(filtered.map(getRowId))}
              disabled={filtered.length === 0}
              className="rounded-md border border-zoru-line px-2 py-1 text-[12px] text-zoru-ink hover:bg-zoru-surface-2 disabled:opacity-50"
            >
              Mark {filtered.length} completed
            </button>
          </div>
        }
      />
    </HrListShell>
  );
}
