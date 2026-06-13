'use client';

/**
 * SabCRM Commerce — POS transactions list client
 * (`/sabcrm/commerce/pos-transactions`).
 *
 * Doc-surface adopter (spec WI-19, read-heavy): KPI strip (completed
 * sales / refunds / voids), the config-driven DocListPage (session +
 * customer labels resolved server-side — "Walk-in" when no customer),
 * a session party filter and CSV export. Creation happens at the
 * register (WI-22); each row links to the DocDetailPage at
 * `/sabcrm/commerce/pos-transactions/[transactionId]`.
 */

import * as React from 'react';
import { CheckCircle2, Receipt, Undo2, XCircle } from 'lucide-react';

import { Badge } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_TXN_METHOD_TONE,
  POS_TXN_STATUSES,
  posTransactionDetailHref,
  toPosTransactionFilters,
} from './pos-transactions-config';

import {
  exportSabcrmPosTransactionRows,
  listSabcrmPosTransactionsPage,
} from '@/app/actions/sabcrm-commerce-pos-transactions.actions';
import { searchSabcrmPosSessions } from '@/app/actions/sabcrm-commerce-docs.actions';
import type {
  SabcrmPosTransactionKpis,
  SabcrmPosTransactionListRow,
} from '@/app/actions/sabcrm-commerce-pos-transactions.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPosTransactionListRow>[] = [
  {
    key: 'transactionNumber',
    header: 'Number',
    kind: 'text',
    value: (r) => r.transactionNumber,
  },
  { key: 'createdAt', header: 'Date', kind: 'date', value: (r) => r.createdAt },
  {
    key: 'session',
    header: 'Session',
    kind: 'party',
    value: (r) => r.sessionLabel,
  },
  {
    key: 'customer',
    header: 'Customer',
    kind: 'text',
    value: (r) => r.customerLabel,
  },
  {
    key: 'total',
    header: 'Total',
    kind: 'money',
    value: (r) => r.total,
    currency: () => 'INR',
  },
  {
    key: 'paymentMethod',
    header: 'Payment',
    kind: 'badge',
    value: (r) => r.paymentMethod,
    tone: (r) => POS_TXN_METHOD_TONE[r.paymentMethod] ?? 'neutral',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

export interface PosTransactionsClientProps {
  initialRows: SabcrmPosTransactionListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPosTransactionKpis | null;
  initialFilters?: Partial<DocListFilters>;
}

export function PosTransactionsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: PosTransactionsClientProps): React.JSX.Element {
  const config = React.useMemo<DocListPageConfig<SabcrmPosTransactionListRow>>(
    () => ({
      title: 'POS transactions',
      description:
        'Sales rung up at the register — line items, payment method and totals.',
      icon: Receipt,
      entity: { singular: 'transaction', plural: 'transactions' },
      columns: COLUMNS,
      statuses: POS_TXN_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPosTransactionsPage(
          toPosTransactionFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPosTransactionRows(toPosTransactionFilters(filters)),
      csvFileName: 'pos-transactions.csv',
      rowHref: (row) => posTransactionDetailHref(row.id),
      rowLabel: (row) => `transaction ${row.transactionNumber}`,
      partyFilter: {
        placeholder: 'Any session',
        search: async (q) => {
          const res = await searchSabcrmPosSessions(q);
          return res.ok ? res.data : [];
        },
      },
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Completed sales"
        icon={CheckCircle2}
        value={formatDocMoney(kpis.completedTotal, kpis.currency)}
        delta={`${kpis.completedCount} ${kpis.completedCount === 1 ? 'transaction' : 'transactions'}`}
        deltaTone={kpis.completedCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Refunded"
        icon={Undo2}
        value={String(kpis.refundedCount)}
        delta="Full or partial"
        deltaTone={kpis.refundedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Voided"
        icon={XCircle}
        value={String(kpis.voidedCount)}
        delta="Cancelled sales"
        deltaTone={kpis.voidedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Total transactions"
        icon={Receipt}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
    </>
  ) : null;

  return (
    <DocListPage
      config={config}
      kpis={kpiStrip}
      primaryAction={<Badge tone="neutral">Sales are rung up at the register</Badge>}
      initialRows={initialRows}
      initialHasMore={initialHasMore}
      initialError={initialError}
      initialFilters={initialFilters}
    />
  );
}
