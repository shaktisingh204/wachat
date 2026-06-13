'use client';

/**
 * SabCRM Supply — Purchase orders list client (`/sabcrm/supply/purchase-orders`).
 *
 * The flagship adopter of the doc-surface kit on the supply side
 * (rollout WI-5): a KPI strip (open value / awaiting approval / overdue
 * deliveries / received this month), the config-driven list (typed
 * columns, search + status + vendor + date-range filters, server
 * pagination, bulk delete, CSV export) and the full DocForm drawer
 * (real vendor picker, ship-to warehouse extra field, real supply items,
 * server-recomputed totals).
 *
 * Every row is display-ready: vendors render as RESOLVED labels — never
 * a raw ObjectId — and the kit's empty/error states handle the
 * first-run and engine-down cases.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  IndianRupee,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '@/app/sabcrm/finance/_components/doc-surface';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

import {
  PO_STATUSES,
  purchaseOrderDetailHref,
  toPoFilters,
} from './purchase-order-config';
import {
  buildPurchaseOrderFormConfig,
  readPoExtras,
} from './purchase-order-form';

import {
  createSabcrmSupplyPurchaseOrderFull,
  exportSabcrmSupplyPurchaseOrderRows,
  listSabcrmSupplyPurchaseOrdersPage,
} from '@/app/actions/sabcrm-supply-purchase-orders.actions';
import {
  searchSabcrmSupplyVendors,
  transitionSabcrmSupplyPurchaseOrderStatus,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { deleteSabcrmSupplyPurchaseOrder } from '@/app/actions/sabcrm-supply.actions';
import type {
  SabcrmPoKpis,
  SabcrmPoListRow,
} from '@/app/actions/sabcrm-supply-purchase-orders.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmPoListRow>[] = [
  { key: 'poNo', header: 'PO number', kind: 'text', value: (r) => r.poNo },
  {
    key: 'vendor',
    header: 'Vendor',
    kind: 'party',
    value: (r) => r.vendorLabel,
  },
  { key: 'date', header: 'Order date', kind: 'date', value: (r) => r.date },
  {
    key: 'expectedDelivery',
    header: 'Expected',
    kind: 'date',
    value: (r) => r.expectedDelivery,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'total',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
  { key: 'aging', header: 'Delivery aging', kind: 'aging', value: (r) => r.agingDays },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface PurchaseOrdersClientProps {
  initialRows: SabcrmPoListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmPoKpis | null;
  initialFilters?: Partial<DocListFilters>;
}

export function PurchaseOrdersClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: PurchaseOrdersClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmPoListRow>>(
    () => ({
      title: 'Purchase orders',
      description:
        'Buy-side documents for this workspace — search, filter, approve, receive and export.',
      icon: ShoppingCart,
      entity: { singular: 'purchase order', plural: 'purchase orders' },
      columns: COLUMNS,
      statuses: PO_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSupplyPurchaseOrdersPage(
          toPoFilters(filters),
        );
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSupplyPurchaseOrderRows(toPoFilters(filters)),
      csvFileName: 'purchase-orders.csv',
      rowHref: (row) => purchaseOrderDetailHref(row.id),
      rowLabel: (row) => `purchase order ${row.poNo}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmSupplyVendors(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'send',
          label: 'Mark as sent',
          run: async (rows) => {
            const sendable = rows.filter(
              (r) => r.status === 'draft' || r.status === 'approved',
            );
            if (sendable.length === 0) {
              return {
                ok: false,
                error: 'Only draft or approved purchase orders can be sent.',
              };
            }
            for (const row of sendable) {
              const res = await transitionSabcrmSupplyPurchaseOrderStatus(
                row.id,
                'sent',
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
            title: 'Delete the selected purchase orders?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete purchase orders',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSupplyPurchaseOrder(row.id);
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
        label="Open PO value"
        icon={IndianRupee}
        value={formatDocMoney(kpis.openValue, kpis.currency)}
        delta={`${kpis.openCount} ${kpis.openCount === 1 ? 'order' : 'orders'} open`}
        deltaTone={kpis.openCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Awaiting approval"
        icon={ClipboardCheck}
        value={String(kpis.awaitingApprovalCount)}
        delta={
          kpis.awaitingApprovalCount === 1
            ? 'order pending sign-off'
            : 'orders pending sign-off'
        }
        deltaTone={kpis.awaitingApprovalCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Overdue deliveries"
        icon={AlertTriangle}
        value={String(kpis.overdueCount)}
        delta={kpis.overdueCount === 1 ? 'order past due' : 'orders past due'}
        deltaTone={kpis.overdueCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Received this month"
        icon={PackageCheck}
        value={String(kpis.receivedThisMonth)}
        delta={
          kpis.receivedThisMonth === 1 ? 'order received' : 'orders received'
        }
        deltaTone={kpis.receivedThisMonth > 0 ? 'up' : 'neutral'}
      />
    </>
  ) : null;

  const formConfig = React.useMemo(
    () => buildPurchaseOrderFormConfig({ withIssue: true }),
    [],
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
            New purchase order
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
        onSubmit={async (values, { issue }) => {
          const extras = readPoExtras(values);
          const res = await createSabcrmSupplyPurchaseOrderFull({
            poNo: values.number,
            vendorId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            expectedDelivery: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            shipToWarehouseId: extras.shipToWarehouseId || undefined,
            paymentTerms: values.paymentTerms || undefined,
            notes: values.customerNotes || undefined,
            termsAndConditions: values.termsAndConditions || undefined,
            issue,
          });
          if (!res.ok) return res;
          toast.success(
            issue
              ? `${res.data.poNo} created and sent.`
              : `${res.data.poNo} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
