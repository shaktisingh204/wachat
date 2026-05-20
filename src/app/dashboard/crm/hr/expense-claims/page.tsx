'use client';

/**
 * HR / Expense Claims — Deep list page (§1D template).
 *
 * KPIs: total claims, pending approval, approved this month, rejected count.
 * Filters: search · status · category · incurred-date range.
 * Bulk: approve · reject · reimburse · archive · delete · export CSV/XLSX.
 * Multi-tenant via getSession in hr.actions / hrList.
 */

import * as React from 'react';
import { Wallet } from 'lucide-react';

import { HrListShell, HrDateCell, HrStatusCell } from '../_components/hr-list-shell';
import {
  HrDeepListBody,
  type DeepColumn,
  type DeepExportColumn,
  type SelectOption,
} from '../_components/hr-deep-list-body';
import { useZoruToast } from '@/components/zoruui';
import {
  bulkApproveExpenseClaims,
  bulkDeleteExpenseClaims,
  bulkReimburseExpenseClaims,
  bulkRejectExpenseClaims,
  deleteExpenseClaim,
  getExpenseClaimKpis,
  getExpenseClaims,
  type HrExpenseClaimKpis,
} from '@/app/actions/hr.actions';

interface ClaimRow {
  _id: string;
  title?: string;
  employeeId?: string;
  amount?: number;
  currency?: string;
  category?: string;
  status?: string;
  incurredAt?: string | Date;
  notes?: string;
}

const BASE = '/dashboard/crm/hr/expense-claims';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'reimbursed', label: 'Reimbursed' },
];

const EMPTY_KPIS: HrExpenseClaimKpis = {
  total: 0,
  pending: 0,
  approvedThisMonth: 0,
  rejected: 0,
  totalClaimed: 0,
  approvedAmount: 0,
};

function getRowId(r: ClaimRow): string {
  return String(r._id ?? '');
}

function getRowStatus(r: ClaimRow): string {
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

export default function ExpenseClaimsPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<ClaimRow[]>([]);
  const [kpis, setKpis] = React.useState<HrExpenseClaimKpis>(EMPTY_KPIS);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<string>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, k] = await Promise.all([
        getExpenseClaims(),
        getExpenseClaimKpis(),
      ]);
      setRows((list ?? []) as unknown as ClaimRow[]);
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

  const categoryOptions: SelectOption[] = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const v = String(r.category ?? '').trim();
      if (v) set.add(v);
    }
    return Array.from(set)
      .sort()
      .map((v) => ({ value: v, label: v }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== 'all' && String(r.category ?? '') !== category) return false;
      if (!inDateRange(r.incurredAt, dateFrom, dateTo)) return false;
      if (!q) return true;
      const hay = `${r.title ?? ''} ${r.category ?? ''} ${r.employeeId ?? ''} ${r.notes ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, category, dateFrom, dateTo, search]);

  const columns: DeepColumn<ClaimRow>[] = [
    { key: 'title', label: 'Claim', render: (r) => r.title || '—' },
    {
      key: 'employeeId',
      label: 'Employee',
      render: (r) => r.employeeId || '—',
    },
    { key: 'category', label: 'Category', render: (r) => r.category || '—' },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      render: (r) => fmtMoney(Number(r.amount) || 0, r.currency ?? ''),
    },
    {
      key: 'incurredAt',
      label: 'Incurred',
      render: (r) => <HrDateCell value={r.incurredAt} />,
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <HrStatusCell value={getRowStatus(r)} />,
    },
  ];

  const exportColumns: DeepExportColumn<ClaimRow>[] = [
    { header: 'Title', value: (r) => r.title ?? '' },
    { header: 'Employee', value: (r) => r.employeeId ?? '' },
    { header: 'Category', value: (r) => r.category ?? '' },
    { header: 'Amount', value: (r) => Number(r.amount) || 0 },
    { header: 'Currency', value: (r) => r.currency ?? '' },
    { header: 'Status', value: (r) => getRowStatus(r) },
    {
      header: 'IncurredAt',
      value: (r) =>
        r.incurredAt ? new Date(r.incurredAt as string).toISOString() : '',
    },
  ];

  /** Stash for the "Reminder" slot — repurposed to "Approve" so we get the
   *  same toast machinery + busy state without bloating the deep-body API. */
  const handleApprove = React.useCallback(
    async (ids: string[]) => {
      const res = await bulkApproveExpenseClaims(ids);
      return { success: res.success, notified: res.updated, error: res.error };
    },
    [],
  );

  const handleReject = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const res = await bulkRejectExpenseClaims(ids);
      if (res.success) {
        toast({ title: `Rejected ${res.updated} claim${res.updated === 1 ? '' : 's'}` });
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

  const handleReimburse = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const res = await bulkReimburseExpenseClaims(ids);
      if (res.success) {
        toast({
          title: `Reimbursed ${res.updated} claim${res.updated === 1 ? '' : 's'}`,
        });
        await refresh();
      } else {
        toast({
          title: 'Reimburse failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, refresh],
  );

  // The HrDeepListBody's "extra" actions live as part of its UI. To expose
  // Reject/Reimburse without forking the body component, we render a thin
  // secondary action bar inside `beforeTable` whenever needed. Selection
  // is private to the body, so this bar is page-level (operates on the
  // current filtered set). Approve uses the body's "reminder" slot.

  return (
    <HrListShell<ClaimRow>
      title="Expense Claims"
      subtitle="Reimbursement requests from employees."
      icon={Wallet}
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
      searchPlaceholder="Search by title, employee, category…"
      kpis={[
        { label: 'Total claims', value: kpis.total.toLocaleString() },
        {
          label: 'Pending approval',
          value: kpis.pending.toLocaleString(),
          tone: kpis.pending > 0 ? 'amber' : 'neutral',
        },
        {
          label: 'Approved this month',
          value: kpis.approvedThisMonth.toLocaleString(),
          tone: 'green',
        },
        {
          label: 'Rejected',
          value: kpis.rejected.toLocaleString(),
          tone: kpis.rejected > 0 ? 'red' : 'neutral',
        },
      ]}
      onDelete={async (id) => {
        const res = await deleteExpenseClaim(id);
        return { success: !!res?.success, error: res?.error };
      }}
      onAfterChange={refresh}
    >
      <HrDeepListBody<ClaimRow>
        rows={filtered}
        columns={columns}
        getRowId={getRowId}
        detailHref={(r) => `${BASE}/${getRowId(r)}`}
        editHref={(r) => `${BASE}/${getRowId(r)}/edit`}
        onDeleteOne={async (id) => {
          const res = await deleteExpenseClaim(id);
          return { success: !!res?.success, error: res?.error };
        }}
        onBulkDelete={async (ids) => {
          const res = await bulkDeleteExpenseClaims(ids);
          return { success: res.success, deleted: res.deleted, error: res.error };
        }}
        onBulkArchive={async (ids) => {
          // Reject acts as the "archive" semantic for expense claims — the
          // hr collection has no `archived` flag for claims, so we map this
          // verb to "reject".
          await handleReject(ids);
          return { success: true, archived: ids.length };
        }}
        onBulkReminder={handleApprove}
        reminderLabel="Approve"
        onAfterChange={refresh}
        search={search}
        setSearch={setSearch}
        searchPlaceholder="Search by title, employee, category…"
        cycleOptions={categoryOptions}
        cycle={category}
        setCycle={setCategory}
        cycleLabel="Category"
        dateFrom={dateFrom}
        dateTo={dateTo}
        setDateFrom={setDateFrom}
        setDateTo={setDateTo}
        exportColumns={exportColumns}
        exportName="expense-claims"
        emptyText="No expense claims match this filter."
        beforeTable={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-zoru-ink-muted">
            <span>
              Total claimed:{' '}
              <span className="font-medium text-zoru-ink">
                {fmtMoney(kpis.totalClaimed, 'INR')}
              </span>
              {' · '}
              Approved value:{' '}
              <span className="font-medium text-zoru-ink">
                {fmtMoney(kpis.approvedAmount, 'INR')}
              </span>
            </span>
            <span>
              Bulk-reimburse the visible filtered set via the body&apos;s
              selection bar &mdash; reject and approve are exposed inline.
            </span>
            <ReimburseFilteredButton
              ids={filtered.map(getRowId)}
              onClick={() => void handleReimburse(filtered.map(getRowId))}
            />
          </div>
        }
      />
    </HrListShell>
  );
}

function ReimburseFilteredButton({
  ids,
  onClick,
}: {
  ids: string[];
  onClick: () => void;
}) {
  if (ids.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zoru-line px-2 py-1 text-[12px] text-zoru-ink hover:bg-zoru-surface-2"
    >
      Mark {ids.length} reimbursed
    </button>
  );
}
