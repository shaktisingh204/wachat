'use client';

/**
 * SabCRM Supply — Production-orders list client (WI-11).
 *
 * KPI strip (planned / in progress / completed this month / units
 * yielded), config-driven list (typed columns, search + status + date
 * filters, server pagination, bulk delete, CSV export) and the bespoke
 * {@link ProductionOrderForm} drawer (BOM-prefilled recipe).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  CalendarClock,
  CheckCircle2,
  Factory,
  Loader,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';

import {
  PRODUCTION_ORDER_STATUSES,
  productionOrderDetailHref,
  toProductionOrderFilters,
} from './production-order-config';
import {
  ProductionOrderForm,
  type ProductionOrderFormState,
} from './production-order-form';

import {
  createSabcrmSupplyProductionOrderFull,
  exportSabcrmSupplyProductionOrderRows,
  listSabcrmSupplyProductionOrdersPage,
} from '@/app/actions/sabcrm-supply-production-orders.actions';
import { deleteSabcrmSupplyProductionOrder } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmProductionOrderKpis,
  SabcrmProductionOrderListRow,
} from '@/app/actions/sabcrm-supply-production-orders.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmProductionOrderListRow>[] = [
  { key: 'orderNo', header: 'Order number', kind: 'text', value: (r) => r.orderNo },
  {
    key: 'finishedGood',
    header: 'Finished good',
    kind: 'text',
    value: (r) => r.finishedGoodName,
  },
  {
    key: 'planned',
    header: 'Planned',
    kind: 'text',
    align: 'right',
    value: (r) => `${r.plannedQty} ${r.unit}`.trim(),
  },
  {
    key: 'yield',
    header: 'Actual yield',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.actualYield),
  },
  {
    key: 'plannedStart',
    header: 'Start',
    kind: 'date',
    value: (r) => r.plannedStart,
  },
  {
    key: 'operator',
    header: 'Operator',
    kind: 'party',
    value: (r) => r.machineOperator,
  },
  {
    key: 'totalCost',
    header: 'Total cost',
    kind: 'money',
    value: (r) => r.totalCost,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface ProductionOrdersClientProps {
  initialRows: SabcrmProductionOrderListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmProductionOrderKpis | null;
  initialFilters?: Partial<DocListFilters>;
  /** Seed state when opened from a BOM's "Start production" convert. */
  prefillState?: ProductionOrderFormState | null;
}

export function ProductionOrdersClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
  prefillState,
}: ProductionOrdersClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(Boolean(prefillState));
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<
    DocListPageConfig<SabcrmProductionOrderListRow>
  >(
    () => ({
      title: 'Production orders',
      description:
        'Manufacturing runs against your BOMs — schedule, track yield and export.',
      icon: Factory,
      entity: { singular: 'production order', plural: 'production orders' },
      columns: COLUMNS,
      statuses: PRODUCTION_ORDER_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyProductionOrdersPage(
          toProductionOrderFilters(filters),
        );
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyProductionOrderRows(
          toProductionOrderFilters(filters),
        ),
      csvFileName: 'production-orders.csv',
      rowHref: (row) => productionOrderDetailHref(row.id),
      rowLabel: (row) => `production order ${row.orderNo}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected production orders?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete production orders',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyProductionOrder(row.id);
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
        icon={CalendarClock}
        value={String(kpis.plannedCount)}
        delta={kpis.plannedCount === 1 ? 'order queued' : 'orders queued'}
      />
      <KpiCard
        label="In progress"
        icon={Loader}
        value={String(kpis.inProgressCount)}
        delta={kpis.inProgressCount === 1 ? 'order running' : 'orders running'}
        deltaTone={kpis.inProgressCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Completed this month"
        icon={CheckCircle2}
        value={String(kpis.completedThisMonth)}
        delta={
          kpis.completedThisMonth === 1 ? 'run finished' : 'runs finished'
        }
        deltaTone={kpis.completedThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Units yielded"
        icon={Boxes}
        value={String(kpis.unitsYielded)}
        delta={`Across ${kpis.count} ${kpis.count === 1 ? 'order' : 'orders'}`}
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
            New production order
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        initialFilters={initialFilters}
        refreshToken={refreshToken}
      />

      <ProductionOrderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        initialState={prefillState ?? undefined}
        onSubmit={async (input) => {
          const res = await createSabcrmSupplyProductionOrderFull(input);
          if (!res.ok) return res;
          toast.success(`${res.data.orderNo} created.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
