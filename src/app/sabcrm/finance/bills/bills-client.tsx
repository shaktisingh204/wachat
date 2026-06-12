'use client';

/**
 * SabCRM Finance — Bills list client (`/sabcrm/finance/bills`).
 *
 * Doc-surface adopter per the finance-rollout spec §3.6: KPI strip
 * (payable outstanding / overdue / due in 7 days / booked this month),
 * config-driven list (vendor labels batch-resolved, bill + vendor
 * invoice numbers, due-date aging, balance, search + status + vendor +
 * date-range filters, server pagination, bulk actions, CSV export) and
 * the full DocForm drawer — vendor picker, item lines AND
 * direct-to-ledger expense lines, TDS / reverse-charge / FX headers,
 * optional due date, server-recomputed totals.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  Plus,
  ReceiptIndianRupee,
  Send,
  Timer,
  Trash2,
  Wallet,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../_components/doc-surface';
import { BILL_STATUSES, billDetailHref, toBillFilters } from './bill-config';
import {
  baseBillFormConfig,
  readBillExtras,
  toExpenseLineInputs,
  validateBillValues,
} from './bill-form';

import {
  createSabcrmBillFull,
  exportSabcrmBillRows,
  getNextSabcrmBillNumber,
  listSabcrmBillsPage,
  transitionSabcrmBillStatus,
} from '@/app/actions/sabcrm-finance-bills.actions';
import { searchSabcrmFinanceVendors } from '@/app/actions/sabcrm-finance-pickers.actions';
import { deleteSabcrmBill } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmBillKpis,
  SabcrmBillListRow,
} from '@/app/actions/sabcrm-finance-bills.actions.types';
import { isBlankDocLine, safeNum } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmBillListRow>[] = [
  { key: 'number', header: 'Number', kind: 'text', value: (r) => r.number },
  {
    key: 'vendorInvoiceNo',
    header: 'Vendor inv.',
    kind: 'text',
    value: (r) => r.vendorInvoiceNo,
  },
  {
    key: 'party',
    header: 'Vendor',
    kind: 'party',
    value: (r) => r.vendorLabel,
  },
  { key: 'billDate', header: 'Date', kind: 'date', value: (r) => r.billDate },
  {
    key: 'dueDate',
    header: 'Due',
    kind: 'date',
    value: (r) => r.dueDate ?? undefined,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'total',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
  {
    key: 'balance',
    header: 'Balance',
    kind: 'money',
    value: (r) => r.balance,
    currency: (r) => r.currency,
  },
  { key: 'aging', header: 'Aging', kind: 'aging', value: (r) => r.agingDays },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface BillsClientProps {
  initialRows: SabcrmBillListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmBillKpis | null;
  /** Toolbar seed parsed from `searchParams` (statements drill-down). */
  initialFilters?: Partial<DocListFilters>;
}

export function BillsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: BillsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmBillListRow>>(
    () => ({
      title: 'Bills',
      description:
        'Vendor bills (accounts payable) — record, approve, pay out and export.',
      icon: ReceiptIndianRupee,
      entity: { singular: 'bill', plural: 'bills' },
      columns: COLUMNS,
      statuses: BILL_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmBillsPage(toBillFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) => exportSabcrmBillRows(toBillFilters(filters)),
      csvFileName: 'bills.csv',
      rowHref: (row) => billDetailHref(row.id),
      rowLabel: (row) => `bill ${row.number}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmFinanceVendors(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'submit',
          label: 'Submit for approval',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return { ok: false, error: 'Only draft bills can be submitted.' };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmBillStatus(row.id, 'submitted');
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected bills?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete bills',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmBill(row.id);
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
        label="Payable outstanding"
        icon={Wallet}
        value={formatDocMoney(kpis.outstanding, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} bills`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'bill' : 'bills'}`
        }
        deltaTone={kpis.outstanding > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Overdue"
        icon={AlertTriangle}
        value={String(kpis.overdueCount)}
        delta={kpis.overdueCount === 1 ? 'bill past due' : 'bills past due'}
        deltaTone={kpis.overdueCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Due in 7 days"
        icon={Timer}
        value={formatDocMoney(kpis.dueSoonAmount, kpis.currency)}
        delta={`${kpis.dueSoonCount} ${kpis.dueSoonCount === 1 ? 'bill' : 'bills'} coming due`}
        deltaTone={kpis.dueSoonCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Booked this month"
        icon={CalendarClock}
        value={formatDocMoney(kpis.thisMonthTotal, kpis.currency)}
        delta={`${kpis.thisMonthCount} ${kpis.thisMonthCount === 1 ? 'bill' : 'bills'} recorded`}
        deltaTone={kpis.thisMonthCount > 0 ? 'up' : 'neutral'}
      />
    </>
  ) : null;

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
            New bill
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />

      <DocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        config={{
          ...baseBillFormConfig('create'),
          issueLabel: 'Save & submit',
          suggestNumber: async () => {
            const res = await getNextSabcrmBillNumber();
            return res.ok ? res.data : null;
          },
        }}
        onSubmit={async (values, { issue }) => {
          const problem = validateBillValues(values);
          if (problem) return { ok: false, error: problem };
          const extras = readBillExtras(values.extras);
          const res = await createSabcrmBillFull({
            billNo: values.number,
            vendorInvoiceNo: extras.vendorInvoiceNo || undefined,
            vendorId: values.partyId ?? '',
            currency: values.currency,
            exchangeRate:
              extras.exchangeRate === ''
                ? undefined
                : safeNum(extras.exchangeRate),
            billDate: values.date,
            dueDate: values.dueDate || undefined,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            expenseLines: toExpenseLineInputs(extras.expenseLines),
            tdsSection: extras.tdsSection || undefined,
            tdsAmount:
              extras.tdsAmount === '' ? undefined : safeNum(extras.tdsAmount),
            reverseCharge: extras.reverseCharge,
            placeOfSupply: values.placeOfSupply || undefined,
            notes: values.customerNotes || undefined,
            issue,
          });
          if (!res.ok) return res;
          if (values.attachments.length > 0) {
            // Engine DTO gap: CreateBillInput carries no attachments —
            // be honest instead of silently dropping.
            toast.message(
              'Attachments are not persisted on bills yet — they were skipped.',
            );
          }
          const label = res.data.billNo || res.data.vendorInvoiceNo || 'Bill';
          toast.success(
            issue
              ? `${label} submitted for approval.`
              : `${label} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
