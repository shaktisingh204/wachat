'use client';

/**
 * SabCRM Supply — GRN list client (`/sabcrm/supply/grn`, rollout WI-6).
 *
 * KPI strip (awaiting inspection / posted this month / rejected / units
 * accepted), config-driven list (typed columns, search + status + vendor
 * + date filters, server pagination, bulk delete, CSV export) and the
 * full DocForm drawer with the bespoke {@link GrnLinesEditor}.
 *
 * Every row is display-ready: vendor / warehouse / PO render as RESOLVED
 * labels — never raw ObjectIds.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageCheck,
  Plus,
  Trash2,
  Truck,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  type DocFormValues,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';

import { GRN_STATUSES, grnDetailHref, toGrnFilters } from './grn-config';
import { buildGrnFormConfig, readGrnExtras } from './grn-form';

import {
  createSabcrmSupplyGrnFull,
  exportSabcrmSupplyGrnRows,
  listSabcrmSupplyGrnsPage,
} from '@/app/actions/sabcrm-supply-grn.actions';
import { searchSabcrmSupplyVendors } from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyGrn } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmGrnKpis,
  SabcrmGrnListRow,
} from '@/app/actions/sabcrm-supply-grn.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmGrnListRow>[] = [
  { key: 'grnNo', header: 'GRN number', kind: 'text', value: (r) => r.grnNo },
  {
    key: 'vendor',
    header: 'Vendor',
    kind: 'party',
    value: (r) => r.vendorLabel,
  },
  {
    key: 'warehouse',
    header: 'Warehouse',
    kind: 'party',
    value: (r) => r.warehouseLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'po',
    header: 'PO',
    kind: 'party',
    value: (r) => r.poLabel,
  },
  {
    key: 'qty',
    header: 'Accepted / received',
    kind: 'text',
    align: 'right',
    value: (r) => `${r.acceptedQty} / ${r.receivedQty}`,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface GrnClientProps {
  initialRows: SabcrmGrnListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmGrnKpis | null;
  initialFilters?: Partial<DocListFilters>;
  /** Seed values when opened from a PO's "Receive → GRN" convert. */
  prefillValues?: DocFormValues | null;
}

export function GrnClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
  prefillValues,
}: GrnClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(Boolean(prefillValues));
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmGrnListRow>>(
    () => ({
      title: 'Goods receipts',
      description:
        'Inbound receipts against your vendors — search, inspect, post and export.',
      icon: Truck,
      entity: { singular: 'goods receipt', plural: 'goods receipts' },
      columns: COLUMNS,
      statuses: GRN_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyGrnsPage(toGrnFilters(filters));
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyGrnRows(toGrnFilters(filters)),
      csvFileName: 'goods-receipts.csv',
      rowHref: (row) => grnDetailHref(row.id),
      rowLabel: (row) => `goods receipt ${row.grnNo}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmSupplyVendors(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected goods receipts?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete goods receipts',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyGrn(row.id);
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
        label="Awaiting inspection"
        icon={ClipboardList}
        value={String(kpis.awaitingInspectionCount)}
        delta={
          kpis.awaitingInspectionCount === 1
            ? 'receipt to inspect'
            : 'receipts to inspect'
        }
        deltaTone={kpis.awaitingInspectionCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Posted this month"
        icon={PackageCheck}
        value={String(kpis.postedThisMonth)}
        delta={kpis.postedThisMonth === 1 ? 'receipt posted' : 'receipts posted'}
        deltaTone={kpis.postedThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Rejected / QC failed"
        icon={AlertTriangle}
        value={String(kpis.rejectedCount)}
        delta={kpis.rejectedCount === 1 ? 'receipt flagged' : 'receipts flagged'}
        deltaTone={kpis.rejectedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Units accepted"
        icon={Boxes}
        value={String(kpis.unitsAccepted)}
        delta={`Across ${kpis.count} ${kpis.count === 1 ? 'receipt' : 'receipts'}`}
      />
    </>
  ) : null;

  const formConfig = React.useMemo(() => buildGrnFormConfig(), []);

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
            New goods receipt
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        initialFilters={initialFilters}
        refreshToken={refreshToken}
      />

      <DocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        config={formConfig}
        initialValues={prefillValues ?? undefined}
        onSubmit={async (values) => {
          const extras = readGrnExtras(values);
          const res = await createSabcrmSupplyGrnFull({
            grnNo: values.number,
            date: values.date,
            vendorId: values.partyId ?? '',
            warehouseId: extras.warehouseId,
            poId: extras.poId || undefined,
            inspectorId: extras.inspectorId || undefined,
            items: extras.grnLines.map((l) => ({
              itemId: l.itemId,
              orderedQty: l.orderedQty,
              receivedQty: l.receivedQty,
              acceptedQty: l.acceptedQty,
              rejectedQty: l.rejectedQty,
              batch: l.batch || undefined,
              expiry: l.expiry || undefined,
              serialNos: l.serialNos,
            })),
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.grnNo} created.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
