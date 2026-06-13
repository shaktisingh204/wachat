'use client';

/**
 * SabCRM Commerce — POS holds list client
 * (`/sabcrm/commerce/pos-holds`).
 *
 * Doc-surface adopter (spec WI-21, read-mostly): KPI strip (held /
 * recalled / parked cart value), the config-driven DocListPage
 * (session + customer labels resolved server-side — "Walk-in" when no
 * customer) and CSV export. Each row's primary action is "Recall at
 * register" (the kit `rowHref` deep-links to
 * `/sabcrm/commerce/register?holdId=<id>`); Void runs as a bulk action.
 */

import * as React from 'react';
import { PauseCircle, PlayCircle, Trash2, Wallet } from 'lucide-react';

import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';
import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import {
  POS_HOLD_STATUSES,
  recallAtRegisterHref,
  toPosHoldFilters,
} from './pos-holds-config';

import {
  exportSabcrmPosHoldRows,
  listSabcrmPosHoldsPage,
} from '@/app/actions/sabcrm-commerce-pos-holds.actions';
import { voidSabcrmPosHold } from '@/app/actions/sabcrm-commerce.actions';
import type {
  SabcrmPosHoldKpis,
  SabcrmPosHoldListRow,
} from '@/app/actions/sabcrm-commerce-pos-holds.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPosHoldListRow>[] = [
  { key: 'heldAt', header: 'Held', kind: 'date', value: (r) => r.heldAt },
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
    key: 'items',
    header: 'Items',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.itemsCount),
  },
  {
    key: 'cartValue',
    header: 'Cart value',
    kind: 'money',
    value: (r) => r.cartValue,
    currency: () => 'INR',
  },
  {
    key: 'holdReason',
    header: 'Reason',
    kind: 'text',
    value: (r) => r.holdReason ?? '',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

export interface PosHoldsClientProps {
  initialRows: SabcrmPosHoldListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPosHoldKpis | null;
}

export function PosHoldsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: PosHoldsClientProps): React.JSX.Element {
  const config = React.useMemo<DocListPageConfig<SabcrmPosHoldListRow>>(
    () => ({
      title: 'POS holds',
      description:
        'Parked register tickets waiting to be recalled at the counter. Recall opens the register with the cart restored.',
      icon: PauseCircle,
      entity: { singular: 'hold', plural: 'holds' },
      columns: COLUMNS,
      statuses: POS_HOLD_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPosHoldsPage(toPosHoldFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPosHoldRows(toPosHoldFilters(filters)),
      csvFileName: 'pos-holds.csv',
      // Recall at register: held tickets deep-link to the register with
      // the cart restored; settled holds are no longer recallable.
      rowHref: (row) =>
        row.status === 'held' ? recallAtRegisterHref(row.id) : null,
      rowLabel: (row) =>
        `hold ${row.holdReason ?? row.heldAt.slice(0, 10)} — recall at register`,
      bulkActions: [
        {
          key: 'void',
          label: 'Void',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Void the selected holds?',
            description:
              'Voided holds are removed from the recall list; their history is preserved.',
            actionLabel: 'Void holds',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await voidSabcrmPosHold(row.id);
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
        label="Held tickets"
        icon={PauseCircle}
        value={String(kpis.heldCount)}
        delta="Awaiting recall"
        deltaTone={kpis.heldCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Recalled"
        icon={PlayCircle}
        value={String(kpis.recalledCount)}
        delta="Resumed at register"
        deltaTone={kpis.recalledCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Parked cart value"
        icon={Wallet}
        value={formatDocMoney(kpis.heldCartValue, kpis.currency)}
        delta="Across held tickets"
      />
      <KpiCard
        label="Total holds"
        icon={PauseCircle}
        value={String(kpis.count)}
        delta={kpis.sampled ? 'Sampled' : 'All-time'}
      />
    </>
  ) : null;

  return (
    <DocListPage
      config={config}
      kpis={kpiStrip}
      initialRows={initialRows}
      initialHasMore={initialHasMore}
      initialError={initialError}
    />
  );
}
