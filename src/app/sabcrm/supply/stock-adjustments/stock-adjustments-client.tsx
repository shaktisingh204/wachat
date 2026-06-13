'use client';

/**
 * SabCRM Supply — Stock adjustments list client
 * (`/sabcrm/supply/stock-adjustments`).
 *
 * Document doc-surface adopter (rollout WI-4): KPI strip (count,
 * draft/approved split, approved value, net units), config-driven list
 * (resolved warehouse + product labels, warehouse party-filter, status
 * filter, search, server pagination, bulk approve/delete, CSV export)
 * and the shared DocForm drawer (warehouse party slot, no lines / due
 * date / payment terms, reason + product + signed quantity + reference
 * + cost in `extraFields`). Rows navigate to the `[id]` detail page.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ClipboardList,
  Layers,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';

import {
  ADJUSTMENT_COLUMNS,
  ADJUSTMENT_STATUSES,
  adjustmentDetailHref,
  toAdjustmentFilters,
} from './stock-adjustment-config';
import {
  buildAdjustmentFormConfig,
  adjustmentFormToInput,
  emptyAdjustmentFormValues,
} from './stock-adjustment-form';
import {
  createSabcrmSupplyStockAdjustmentFull,
  exportSabcrmSupplyStockAdjustmentRows,
  listSabcrmSupplyStockAdjustmentsPage,
} from '@/app/actions/sabcrm-supply-stock-adjustments.actions';
import {
  searchSabcrmSupplyWarehouses,
  transitionSabcrmSupplyStockAdjustmentStatus,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyStockAdjustment } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmSupplyStockAdjustmentKpis,
  SabcrmSupplyStockAdjustmentListRow,
} from '@/app/actions/sabcrm-supply-stock-adjustments.actions.types';

export interface StockAdjustmentsClientProps {
  initialRows: SabcrmSupplyStockAdjustmentListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmSupplyStockAdjustmentKpis | null;
}

export function StockAdjustmentsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: StockAdjustmentsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<
    DocListPageConfig<SabcrmSupplyStockAdjustmentListRow>
  >(
    () => ({
      title: 'Stock adjustments',
      description:
        'Corrections to on-hand quantities — record, approve and value inventory changes.',
      icon: ClipboardList,
      entity: { singular: 'adjustment', plural: 'adjustments' },
      columns: ADJUSTMENT_COLUMNS,
      statuses: ADJUSTMENT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyStockAdjustmentsPage(
          toAdjustmentFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyStockAdjustmentRows(toAdjustmentFilters(filters)),
      csvFileName: 'stock-adjustments.csv',
      rowHref: (row) => adjustmentDetailHref(row.id),
      rowLabel: (row) =>
        `adjustment ${row.adjustmentNumber || row.id.slice(-6)}`,
      partyFilter: {
        placeholder: 'Any warehouse',
        search: async (q) => {
          const res = await searchSabcrmSupplyWarehouses(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'approve',
          label: 'Approve',
          icon: CheckCircle2,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return {
                ok: false,
                error: 'Only draft adjustments can be approved.',
              };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmSupplyStockAdjustmentStatus(
                row.id,
                'approved',
              );
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
            title: 'Delete the selected adjustments?',
            description:
              'This permanently removes them. Stock levels already changed by approved adjustments are NOT rolled back.',
            actionLabel: 'Delete adjustments',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyStockAdjustment(row.id);
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
        label="Adjustments"
        icon={ClipboardList}
        value={String(kpis.count)}
        delta={`${kpis.draftCount} draft · ${kpis.approvedCount} approved`}
      />
      <KpiCard
        label="Approved value"
        icon={Scale}
        value={formatDocMoney(kpis.approvedValue, kpis.currency)}
        delta="At cost (absolute)"
      />
      <KpiCard
        label="Net units"
        icon={TrendingUp}
        value={String(kpis.netUnits)}
        delta={kpis.netUnits >= 0 ? 'Net stock in' : 'Net stock out'}
        deltaTone={kpis.netUnits > 0 ? 'up' : kpis.netUnits < 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Pending review"
        icon={Layers}
        value={String(kpis.draftCount)}
        delta={kpis.draftCount === 1 ? 'draft awaiting approval' : 'drafts awaiting approval'}
        deltaTone={kpis.draftCount > 0 ? 'down' : 'neutral'}
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
            New adjustment
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
        initialValues={emptyAdjustmentFormValues()}
        config={buildAdjustmentFormConfig({ mode: 'create' })}
        onSubmit={async (values) => {
          const mapped = adjustmentFormToInput(values);
          if (!mapped.ok) return mapped;
          const res = await createSabcrmSupplyStockAdjustmentFull(mapped.input);
          if (!res.ok) return res;
          toast.success(
            `${res.data.adjustmentNumber || 'Adjustment'} recorded.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
