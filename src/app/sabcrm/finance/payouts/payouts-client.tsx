'use client';

/**
 * SabCRM Finance — Payouts list client (`/sabcrm/finance/payouts`).
 *
 * Doc-surface adopter for vendor payouts (spec §3.8): KPI strip (paid
 * this month / uncleared / failed / TDS withheld FY), config-driven
 * list (typed columns, search + status + vendor + date-range filters,
 * server pagination, bulk actions, CSV export) and the full DocForm
 * drawer (real vendor picker over supply vendors, real payment account,
 * bill allocations that flip bill statuses server-side).
 *
 * Every row is display-ready: vendors and accounts render as RESOLVED
 * labels — never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  PAYOUT_STATUSES,
  payoutDetailHref,
  payoutModeLabel,
  toPayoutFilters,
} from './payout-config';
import {
  buildPayoutFormConfig,
  emptyPayoutFormValues,
  payoutFormToInput,
} from './payout-form';

import {
  createSabcrmPayoutFull,
  exportSabcrmPayoutRows,
  listSabcrmPayoutsPage,
  transitionSabcrmPayoutStatus,
} from '@/app/actions/sabcrm-finance-payouts.actions';
import { deleteSabcrmPayout } from '@/app/actions/sabcrm-finance.actions';
import { searchSabcrmFinanceVendors } from '@/app/actions/sabcrm-finance-pickers.actions';
import type {
  SabcrmPayoutKpis,
  SabcrmPayoutListRow,
} from '@/app/actions/sabcrm-finance-payouts.actions.types';
import type { SabcrmPaymentAccountOption } from '@/app/actions/sabcrm-finance-invoices.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPayoutListRow>[] = [
  {
    key: 'paymentNo',
    header: 'Number',
    kind: 'text',
    value: (r) => r.paymentNo,
  },
  {
    key: 'vendor',
    header: 'Vendor',
    kind: 'party',
    value: (r) => r.vendorLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'mode',
    header: 'Mode',
    kind: 'badge',
    value: (r) => payoutModeLabel(r.mode),
  },
  {
    key: 'account',
    header: 'Paid from',
    kind: 'party',
    value: (r) => r.bankAccountLabel,
  },
  {
    key: 'amount',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.amount,
    currency: (r) => r.currency,
  },
  {
    key: 'tds',
    header: 'TDS',
    kind: 'money',
    value: (r) => r.tdsDeducted,
    currency: (r) => r.currency,
  },
  {
    key: 'applied',
    header: 'Applied',
    kind: 'badge',
    value: (r) =>
      r.appliedBills > 0
        ? `${r.appliedBills} ${r.appliedBills === 1 ? 'bill' : 'bills'}`
        : '',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface PayoutsClientProps {
  initialRows: SabcrmPayoutListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPayoutKpis | null;
  paymentAccounts: SabcrmPaymentAccountOption[];
}

export function PayoutsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  paymentAccounts,
}: PayoutsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmPayoutListRow>>(
    () => ({
      title: 'Payouts',
      description:
        'Outgoing vendor payments — disburse, allocate to bills, clear and export.',
      icon: Banknote,
      entity: { singular: 'payout', plural: 'payouts' },
      columns: COLUMNS,
      statuses: PAYOUT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPayoutsPage(toPayoutFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPayoutRows(toPayoutFilters(filters)),
      csvFileName: 'payouts.csv',
      rowHref: (row) => payoutDetailHref(row.id),
      rowLabel: (row) => `payout ${row.paymentNo}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmFinanceVendors(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-cleared',
          label: 'Mark as cleared',
          icon: CheckCircle2,
          run: async (rows) => {
            const sent = rows.filter((r) => r.status === 'sent');
            if (sent.length === 0) {
              return {
                ok: false,
                error: 'Only sent payouts can be marked cleared.',
              };
            }
            for (const row of sent) {
              const res = await transitionSabcrmPayoutStatus(row.id, 'cleared');
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
            title: 'Delete the selected payouts?',
            description:
              'Payouts are HARD-deleted — this permanently removes them and cannot be undone. Bill statuses they flipped are not reverted.',
            actionLabel: 'Delete payouts',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmPayout(row.id);
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
        label="Paid this month"
        icon={CalendarClock}
        value={formatDocMoney(kpis.paidThisMonth, kpis.currency)}
        delta={`${kpis.paidThisMonthCount} ${kpis.paidThisMonthCount === 1 ? 'payout' : 'payouts'} issued`}
        deltaTone={kpis.paidThisMonthCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Awaiting clearance"
        icon={IndianRupee}
        value={formatDocMoney(kpis.unclearedTotal, kpis.currency)}
        delta={`${kpis.unclearedCount} ${kpis.unclearedCount === 1 ? 'payout' : 'payouts'} in transit`}
        deltaTone={kpis.unclearedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Failed"
        icon={AlertTriangle}
        value={String(kpis.failedCount)}
        delta={kpis.failedCount === 1 ? 'payout to retry' : 'payouts to retry'}
        deltaTone={kpis.failedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="TDS withheld (FY)"
        icon={Banknote}
        value={formatDocMoney(kpis.tdsWithheldFy, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} payouts`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'payout' : 'payouts'}`
        }
      />
    </>
  ) : null;

  const formConfig = React.useMemo(
    () => buildPayoutFormConfig(paymentAccounts, 'create'),
    [paymentAccounts],
  );
  const createSeed = React.useMemo(
    () => (formOpen ? emptyPayoutFormValues() : undefined),
    [formOpen],
  );

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
            New payout
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <DocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        initialValues={createSeed}
        config={formConfig}
        onSubmit={async (values) => {
          const mapped = payoutFormToInput(values);
          if (!mapped.ok) return mapped;
          const res = await createSabcrmPayoutFull(mapped.input);
          if (!res.ok) return res;
          toast.success(`${res.data.paymentNo} recorded.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
