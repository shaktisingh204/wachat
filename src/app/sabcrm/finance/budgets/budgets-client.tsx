'use client';

/**
 * SabCRM Finance — Budgets list client (`/sabcrm/finance/budgets`).
 *
 * Doc-surface adopter for budgets (spec §3.16): KPI strip (planned /
 * actual / utilisation % / over-budget heads), config-driven list
 * (typed columns incl. a utilisation badge that flips to danger when
 * over 100%, search + status + date-range filters, server pagination,
 * Approve bulk action, CSV export) and the full-field budget dialog.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  CheckCircle2,
  Gauge,
  PiggyBank,
  Plus,
  TriangleAlert,
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
  BUDGET_STATUSES,
  budgetDetailHref,
  toBudgetFilters,
} from './budget-config';
import { BudgetFormDialog } from './budget-form';

import {
  exportSabcrmBudgetRows,
  listSabcrmBudgetsPage,
  transitionSabcrmBudgetStatus,
} from '@/app/actions/sabcrm-finance-budgets.actions';
import { deleteSabcrmBudget } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmBudgetKpis,
  SabcrmBudgetListRow,
} from '@/app/actions/sabcrm-finance-budgets.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmBudgetListRow>[] = [
  {
    key: 'budgetHead',
    header: 'Budget head',
    kind: 'text',
    value: (r) => r.budgetHead,
  },
  {
    key: 'department',
    header: 'Department',
    kind: 'badge',
    value: (r) => r.department,
  },
  { key: 'period', header: 'Period', kind: 'text', value: (r) => r.period },
  {
    key: 'planned',
    header: 'Planned',
    kind: 'money',
    value: (r) => r.plannedAmount,
    currency: (r) => r.currency,
  },
  {
    key: 'actual',
    header: 'Actual',
    kind: 'money',
    value: (r) => r.actualAmount,
    currency: (r) => r.currency,
  },
  {
    key: 'utilisation',
    header: 'Utilisation',
    kind: 'badge',
    value: (r) =>
      r.plannedAmount > 0 ? `${Math.round(r.utilisation * 100)}%` : '',
    tone: (r) =>
      r.overBudget ? 'danger' : r.utilisation > 0.8 ? 'warning' : 'success',
    csv: (r) =>
      r.plannedAmount > 0 ? String(Math.round(r.utilisation * 100)) : '',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface BudgetsClientProps {
  initialRows: SabcrmBudgetListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmBudgetKpis | null;
}

export function BudgetsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: BudgetsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmBudgetListRow>>(
    () => ({
      title: 'Budgets',
      description:
        'Planned vs actual spend per head and period — approve, lock and export.',
      icon: PiggyBank,
      entity: { singular: 'budget', plural: 'budgets' },
      columns: COLUMNS,
      statuses: BUDGET_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmBudgetsPage(toBudgetFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmBudgetRows(toBudgetFilters(filters)),
      csvFileName: 'budgets.csv',
      rowHref: (row) => budgetDetailHref(row.id),
      rowLabel: (row) => `budget ${row.budgetHead}`,
      bulkActions: [
        {
          key: 'approve',
          label: 'Approve selected',
          icon: CheckCircle2,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return {
                ok: false,
                error: 'Only draft budgets can be approved.',
              };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmBudgetStatus(
                row.id,
                'approved',
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
            title: 'Archive the selected budgets?',
            description:
              'Archived budgets disappear from the list (crm-common soft delete).',
            actionLabel: 'Archive budgets',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmBudget(row.id);
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
        label="Planned"
        icon={PiggyBank}
        value={formatDocMoney(kpis.plannedTotal, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} budgets`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'budget' : 'budgets'}`
        }
      />
      <KpiCard
        label="Actual"
        icon={Gauge}
        value={formatDocMoney(kpis.actualTotal, kpis.currency)}
        delta="Recorded against plans"
      />
      <KpiCard
        label="Utilisation"
        icon={Gauge}
        value={`${kpis.utilisationPct}%`}
        delta="Actual ÷ planned"
        deltaTone={kpis.utilisationPct > 100 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Over budget"
        icon={TriangleAlert}
        value={String(kpis.overBudgetCount)}
        delta={
          kpis.overBudgetCount === 1
            ? 'head over its plan'
            : 'heads over their plans'
        }
        deltaTone={kpis.overBudgetCount > 0 ? 'down' : 'neutral'}
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
            New budget
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />

      <BudgetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onDone={onDone}
      />
    </>
  );
}
