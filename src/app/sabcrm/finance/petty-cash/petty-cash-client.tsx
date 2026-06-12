'use client';

/**
 * SabCRM Finance — Petty cash list client (`/sabcrm/finance/petty-cash`).
 *
 * Doc-surface adopter for petty-cash floats (spec §3.15): KPI strip
 * (total float balance / active / low balance / closed), config-driven
 * list (typed columns incl. a balance-utilisation badge with a
 * low-balance alert tone, search + status + date-range filters, server
 * pagination, bulk close/archive, CSV export) and the full-field float
 * dialog (real custodian picker writing id + name).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  CircleDollarSign,
  Lock,
  Plus,
  TriangleAlert,
  Vault,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  PETTY_CASH_STATUSES,
  pettyCashDetailHref,
  toPettyCashFilters,
} from './petty-cash-config';
import { PettyCashFormDialog } from './petty-cash-form';

import {
  exportSabcrmPettyCashRows,
  listSabcrmPettyCashPage,
  transitionSabcrmPettyCashStatus,
} from '@/app/actions/sabcrm-finance-petty-cash.actions';
import { deleteSabcrmPettyCashFloat } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmPettyCashKpis,
  SabcrmPettyCashListRow,
} from '@/app/actions/sabcrm-finance-petty-cash.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPettyCashListRow>[] = [
  {
    key: 'branch',
    header: 'Branch',
    kind: 'text',
    value: (r) => r.branchLabel,
  },
  {
    key: 'custodian',
    header: 'Custodian',
    kind: 'party',
    value: (r) => r.custodianLabel,
  },
  {
    key: 'opening',
    header: 'Opening',
    kind: 'money',
    value: (r) => r.openingBalance,
    currency: (r) => r.currency,
  },
  {
    key: 'current',
    header: 'Current',
    kind: 'money',
    value: (r) => r.currentBalance,
    currency: (r) => r.currency,
  },
  {
    key: 'level',
    header: 'Level',
    kind: 'badge',
    value: (r) =>
      r.openingBalance > 0
        ? `${Math.round(r.utilisation * 100)}%`
        : '',
    tone: (r) =>
      r.lowBalance ? 'danger' : r.utilisation < 0.5 ? 'warning' : 'success',
    csv: (r) =>
      r.openingBalance > 0 ? String(Math.round(r.utilisation * 100)) : '',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
  {
    key: 'createdAt',
    header: 'Created',
    kind: 'date',
    value: (r) => r.createdAt,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface PettyCashClientProps {
  initialRows: SabcrmPettyCashListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPettyCashKpis | null;
}

export function PettyCashClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: PettyCashClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmPettyCashListRow>>(
    () => ({
      title: 'Petty cash',
      description:
        'Branch cash floats — custodians, balances, refill alerts and export.',
      icon: Vault,
      entity: { singular: 'float', plural: 'floats' },
      columns: COLUMNS,
      statuses: PETTY_CASH_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPettyCashPage(toPettyCashFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPettyCashRows(toPettyCashFilters(filters)),
      csvFileName: 'petty-cash-floats.csv',
      rowHref: (row) => pettyCashDetailHref(row.id),
      rowLabel: (row) =>
        `float ${row.branchLabel || row.custodianLabel || row.id}`,
      bulkActions: [
        {
          key: 'close',
          label: 'Close selected',
          icon: Lock,
          run: async (rows) => {
            const active = rows.filter((r) => r.status === 'active');
            if (active.length === 0) {
              return { ok: false, error: 'Only active floats can be closed.' };
            }
            for (const row of active) {
              const res = await transitionSabcrmPettyCashStatus(
                row.id,
                'closed',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected floats?',
            description:
              'Archived floats disappear from the list (crm-common soft delete).',
            actionLabel: 'Archive floats',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmPettyCashFloat(row.id);
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
        label="Total float balance"
        icon={CircleDollarSign}
        value={formatDocMoney(kpis.totalFloatBalance, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} floats`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'float' : 'floats'}`
        }
      />
      <KpiCard
        label="Active floats"
        icon={Vault}
        value={String(kpis.activeCount)}
        delta="In circulation"
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Low balance"
        icon={TriangleAlert}
        value={String(kpis.lowBalanceCount)}
        delta="Below 10% of opening"
        deltaTone={kpis.lowBalanceCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Closed"
        icon={Lock}
        value={String(kpis.closedCount)}
        delta={kpis.closedCount === 1 ? 'float closed' : 'floats closed'}
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
            New float
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <PettyCashFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onDone={onDone}
      />
    </>
  );
}
