'use client';

/**
 * SabCRM Supply — BOM list client (`/sabcrm/supply/bom`, rollout WI-10).
 *
 * KPI strip (active / draft / obsolete / average cost), config-driven
 * list (typed columns, search + status + date filters, server
 * pagination, bulk delete, CSV export) and the bespoke {@link BomForm}
 * drawer with the shared components editor.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleDashed,
  CircleSlash,
  IndianRupee,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';

import { BOM_STATUSES, bomDetailHref, toBomFilters } from './bom-config';
import { BomForm } from './bom-form';

import {
  createSabcrmSupplyBomFull,
  exportSabcrmSupplyBomRows,
  listSabcrmSupplyBomsPage,
} from '@/app/actions/sabcrm-supply-bom.actions';
import { deleteSabcrmSupplyBom } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmBomKpis,
  SabcrmBomListRow,
} from '@/app/actions/sabcrm-supply-bom.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmBomListRow>[] = [
  { key: 'bomNo', header: 'BOM number', kind: 'text', value: (r) => r.bomNo },
  {
    key: 'finishedGood',
    header: 'Finished good',
    kind: 'text',
    value: (r) => r.finishedGoodName,
  },
  {
    key: 'output',
    header: 'Output',
    kind: 'text',
    value: (r) => `${r.outputQty} ${r.unit}`.trim(),
  },
  {
    key: 'components',
    header: 'Components',
    kind: 'text',
    align: 'right',
    value: (r) => String(r.componentCount),
  },
  { key: 'version', header: 'Version', kind: 'badge', value: (r) => `v${r.version}` },
  {
    key: 'totalCost',
    header: 'Total cost',
    kind: 'money',
    value: (r) => r.totalCost,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface BomClientProps {
  initialRows: SabcrmBomListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmBomKpis | null;
  initialFilters?: Partial<DocListFilters>;
}

export function BomClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: BomClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmBomListRow>>(
    () => ({
      title: 'Bills of material',
      description:
        'Recipes that define how finished goods are built — search, version, cost and export.',
      icon: Layers,
      entity: { singular: 'bill of materials', plural: 'bills of material' },
      columns: COLUMNS,
      statuses: BOM_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyBomsPage(toBomFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyBomRows(toBomFilters(filters)),
      csvFileName: 'bills-of-material.csv',
      rowHref: (row) => bomDetailHref(row.id),
      rowLabel: (row) => `bill of materials ${row.bomNo}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected bills of material?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete BOMs',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyBom(row.id);
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
        label="Active BOMs"
        icon={Layers}
        value={String(kpis.activeCount)}
        delta={kpis.activeCount === 1 ? 'recipe live' : 'recipes live'}
        deltaTone={kpis.activeCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Drafts"
        icon={CircleDashed}
        value={String(kpis.draftCount)}
        delta={kpis.draftCount === 1 ? 'in progress' : 'in progress'}
      />
      <KpiCard
        label="Obsolete"
        icon={CircleSlash}
        value={String(kpis.obsoleteCount)}
        delta={kpis.obsoleteCount === 1 ? 'retired' : 'retired'}
      />
      <KpiCard
        label="Average cost"
        icon={IndianRupee}
        value={formatDocMoney(kpis.avgCost, 'INR')}
        delta={`Across ${kpis.count} ${kpis.count === 1 ? 'BOM' : 'BOMs'}`}
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
            New BOM
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        initialFilters={initialFilters}
        refreshToken={refreshToken}
      />

      <BomForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        onSubmit={async (input) => {
          const res = await createSabcrmSupplyBomFull(input);
          if (!res.ok) return res;
          toast.success(`${res.data.bomNo} created.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
