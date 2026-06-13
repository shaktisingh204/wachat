'use client';

/**
 * SabCRM Finance — Expenses list client (`/sabcrm/finance/expenses`).
 *
 * Doc-surface adopter for expense claims (spec §3.12): KPI strip
 * (pending approval / reimbursed this month / rejected / average
 * claim), config-driven list (typed columns incl. category badge +
 * receipt indicator, search + status + employee + date-range filters,
 * server pagination, Approve/Reject bulk actions, CSV export) and the
 * full-field claim dialog (real person picker, SabFiles receipt).
 *
 * Every row is display-ready: employees render as RESOLVED labels —
 * never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleSlash,
  HandCoins,
  Plus,
  ReceiptIndianRupee,
  Trash2,
  XCircle,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  EXPENSE_STATUSES,
  expenseDetailHref,
  toExpenseFilters,
} from './expense-config';
import { ExpenseFormDialog } from './expense-form';

import {
  exportSabcrmExpenseRows,
  listSabcrmExpensesPage,
  transitionSabcrmExpenseStatus,
} from '@/app/actions/sabcrm-finance-expenses.actions';
import { deleteSabcrmExpense } from '@/app/actions/sabcrm-finance.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import type {
  SabcrmExpenseKpis,
  SabcrmExpenseListRow,
} from '@/app/actions/sabcrm-finance-expenses.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const truncate = (s: string, n = 48): string =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;

const COLUMNS: DocListColumn<SabcrmExpenseListRow>[] = [
  {
    key: 'claimNumber',
    header: 'Claim',
    kind: 'text',
    value: (r) => r.claimNumber,
  },
  {
    key: 'employee',
    header: 'Employee',
    kind: 'party',
    value: (r) => r.employeeLabel,
  },
  {
    key: 'category',
    header: 'Category',
    kind: 'badge',
    value: (r) => r.categoryLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'description',
    header: 'Description',
    kind: 'text',
    value: (r) => truncate(r.description),
    csv: (r) => r.description,
  },
  {
    key: 'amount',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.amount,
    currency: (r) => r.currency,
  },
  {
    key: 'receipt',
    header: 'Receipt',
    kind: 'badge',
    value: (r) => (r.hasReceipt ? 'Receipt' : ''),
    tone: () => 'info',
    csv: (r) => (r.hasReceipt ? 'yes' : 'no'),
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
  {
    key: 'approver',
    header: 'Approver',
    kind: 'text',
    value: (r) => r.approverLabel,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface ExpensesClientProps {
  initialRows: SabcrmExpenseListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmExpenseKpis | null;
  /** Statements drill-down deep-link seed (parsed from searchParams). */
  initialFilters?: Partial<DocListFilters>;
}

export function ExpensesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: ExpensesClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmExpenseListRow>>(
    () => ({
      title: 'Expenses',
      description:
        'Employee expense claims — submit, approve, reimburse and export.',
      icon: ReceiptIndianRupee,
      entity: { singular: 'expense claim', plural: 'expense claims' },
      columns: COLUMNS,
      statuses: EXPENSE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmExpensesPage(toExpenseFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmExpenseRows(toExpenseFilters(filters)),
      csvFileName: 'expense-claims.csv',
      rowHref: (row) => expenseDetailHref(row.id),
      rowLabel: (row) => `expense claim ${row.claimNumber}`,
      partyFilter: {
        placeholder: 'Any employee',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          if (!res.ok) return [];
          return res.data
            .filter((p) => p.objectSlug === 'people')
            .map((p) => ({ id: p.id, label: p.label, meta: p.meta }));
        },
      },
      bulkActions: [
        {
          key: 'approve',
          label: 'Approve selected',
          icon: CheckCircle2,
          run: async (rows) => {
            const submitted = rows.filter((r) => r.status === 'submitted');
            if (submitted.length === 0) {
              return {
                ok: false,
                error: 'Only submitted claims can be approved.',
              };
            }
            for (const row of submitted) {
              const res = await transitionSabcrmExpenseStatus(
                row.id,
                'approved',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'reject',
          label: 'Reject selected',
          icon: XCircle,
          run: async (rows) => {
            const submitted = rows.filter((r) => r.status === 'submitted');
            if (submitted.length === 0) {
              return {
                ok: false,
                error: 'Only submitted claims can be rejected.',
              };
            }
            for (const row of submitted) {
              const res = await transitionSabcrmExpenseStatus(
                row.id,
                'rejected',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Archive',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected expense claims?',
            description:
              'Archived claims disappear from the list (crm-common soft delete).',
            actionLabel: 'Archive claims',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmExpense(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Pending approval"
        icon={HandCoins}
        value={formatDocMoney(kpis.pendingApprovalAmount, kpis.currency)}
        delta={`${kpis.pendingApprovalCount} ${kpis.pendingApprovalCount === 1 ? 'claim' : 'claims'} submitted`}
        deltaTone={kpis.pendingApprovalCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Reimbursed this month"
        icon={CheckCircle2}
        value={formatDocMoney(kpis.reimbursedThisMonth, kpis.currency)}
        delta={`${kpis.reimbursedThisMonthCount} ${kpis.reimbursedThisMonthCount === 1 ? 'claim' : 'claims'} paid out`}
        deltaTone={kpis.reimbursedThisMonthCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Rejected"
        icon={CircleSlash}
        value={String(kpis.rejectedCount)}
        delta={kpis.rejectedCount === 1 ? 'claim rejected' : 'claims rejected'}
        deltaTone={kpis.rejectedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Average claim"
        icon={ReceiptIndianRupee}
        value={formatDocMoney(kpis.averageClaim, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} claims`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'claim' : 'claims'}`
        }
      />
    </>
  ) : null;

  const onDone = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  }, [router]);

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setFormOpen(true)}
          >
            New expense claim
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        initialFilters={initialFilters}
        refreshToken={refreshToken}
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onDone={onDone}
      />
    </>
  );
}
