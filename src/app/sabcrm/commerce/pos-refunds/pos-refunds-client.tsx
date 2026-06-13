'use client';

/**
 * SabCRM Commerce — POS refunds list client
 * (`/sabcrm/commerce/pos-refunds`).
 *
 * Doc-surface adopter (spec WI-20, read-mostly): KPI strip (pending /
 * completed / refunded value), the config-driven DocListPage (original
 * transaction number resolved + linked, never an ObjectId) and CSV
 * export. Refunds are minted from the transaction detail (WI-19); each
 * row links to the DocDetailPage at
 * `/sabcrm/commerce/pos-refunds/[refundId]`.
 */

import * as React from 'react';
import { CheckCircle2, Hourglass, Undo2 } from 'lucide-react';

import { Badge } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_REFUND_STATUSES,
  posRefundDetailHref,
  toPosRefundFilters,
} from './pos-refunds-config';

import {
  exportSabcrmPosRefundRows,
  listSabcrmPosRefundsPage,
} from '@/app/actions/sabcrm-commerce-pos-refunds.actions';
import type {
  SabcrmPosRefundKpis,
  SabcrmPosRefundListRow,
} from '@/app/actions/sabcrm-commerce-pos-refunds.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPosRefundListRow>[] = [
  {
    key: 'txn',
    header: 'Transaction',
    kind: 'party',
    value: (r) => r.originalTransactionNumber,
  },
  {
    key: 'processedAt',
    header: 'Processed',
    kind: 'date',
    value: (r) => r.processedAt,
  },
  { key: 'reason', header: 'Reason', kind: 'text', value: (r) => r.reason },
  {
    key: 'refundTotal',
    header: 'Refunded',
    kind: 'money',
    value: (r) => r.refundTotal,
    currency: () => 'INR',
  },
  {
    key: 'refundMethod',
    header: 'Method',
    kind: 'badge',
    value: (r) => r.refundMethod,
    tone: () => 'neutral',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

export interface PosRefundsClientProps {
  initialRows: SabcrmPosRefundListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPosRefundKpis | null;
}

export function PosRefundsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: PosRefundsClientProps): React.JSX.Element {
  const config = React.useMemo<DocListPageConfig<SabcrmPosRefundListRow>>(
    () => ({
      title: 'POS refunds',
      description:
        'Refunds issued against register transactions — reason, amount and status.',
      icon: Undo2,
      entity: { singular: 'refund', plural: 'refunds' },
      columns: COLUMNS,
      statuses: POS_REFUND_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPosRefundsPage(toPosRefundFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPosRefundRows(toPosRefundFilters(filters)),
      csvFileName: 'pos-refunds.csv',
      rowHref: (row) => posRefundDetailHref(row.id),
      rowLabel: (row) =>
        `refund ${row.originalTransactionNumber ?? row.id}`,
    }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Pending"
        icon={Hourglass}
        value={String(kpis.pendingCount)}
        delta="Awaiting completion"
        deltaTone={kpis.pendingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Completed"
        icon={CheckCircle2}
        value={String(kpis.completedCount)}
        delta="Settled refunds"
        deltaTone={kpis.completedCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Refunded value"
        icon={Undo2}
        value={formatDocMoney(kpis.refundedTotal, kpis.currency)}
        delta={kpis.sampled ? 'Across the latest sample' : 'All-time'}
      />
      <KpiCard
        label="Total refunds"
        icon={Undo2}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
    </>
  ) : null;

  return (
    <DocListPage
      config={config}
      kpis={kpiStrip}
      primaryAction={
        <Badge tone="neutral">Refunds are issued from a transaction</Badge>
      }
      initialRows={initialRows}
      initialHasMore={initialHasMore}
      initialError={initialError}
    />
  );
}
