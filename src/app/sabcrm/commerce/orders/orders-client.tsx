'use client';

/**
 * SabCRM Commerce — Orders list client (`/sabcrm/commerce/orders`).
 *
 * Doc-surface adopter (spec WI-13, read-heavy): KPI strip (paid /
 * pending / unfulfilled / this month), the config-driven DocListPage
 * (storefront labels resolved server-side — never an ObjectId), a
 * storefront party filter and bulk lifecycle actions (mark paid / mark
 * fulfilled / cancel). Orders originate from storefront checkout — no
 * create form. Each row links to the DocDetailPage at
 * `/sabcrm/commerce/orders/[orderId]`.
 */

import * as React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Wallet,
} from 'lucide-react';

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
  ORDER_FULFILLMENT_LABEL,
  ORDER_FULFILLMENT_TONE,
  ORDER_PAYMENT_STATUSES,
  orderDetailHref,
  toOrderFilters,
} from './orders-config';

import {
  exportSabcrmStoreOrderRows,
  listSabcrmStoreOrdersPage,
} from '@/app/actions/sabcrm-commerce-orders.actions';
import { searchSabcrmStorefronts } from '@/app/actions/sabcrm-commerce-docs.actions';
import {
  markSabcrmStoreOrderPaid,
  markSabcrmStoreOrderFulfilled,
  cancelSabcrmStoreOrder,
} from '@/app/actions/sabcrm-commerce.actions';
import type {
  SabcrmStoreOrderKpis,
  SabcrmStoreOrderListRow,
} from '@/app/actions/sabcrm-commerce-orders.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmStoreOrderListRow>[] = [
  {
    key: 'orderNumber',
    header: 'Order #',
    kind: 'text',
    value: (r) => r.orderNumber,
  },
  { key: 'placedAt', header: 'Placed', kind: 'date', value: (r) => r.placedAt },
  {
    key: 'customerName',
    header: 'Customer',
    kind: 'text',
    value: (r) => r.customerName,
    csv: (r) => `${r.customerName} <${r.customerEmail}>`,
  },
  {
    key: 'storefront',
    header: 'Storefront',
    kind: 'party',
    value: (r) => r.storefrontLabel,
  },
  {
    key: 'total',
    header: 'Total',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    kind: 'status',
    value: (r) => r.paymentStatus,
  },
  {
    key: 'fulfillment',
    header: 'Fulfilment',
    kind: 'badge',
    value: (r) => ORDER_FULFILLMENT_LABEL[r.fulfillmentStatus] ?? r.fulfillmentStatus,
    tone: (r) => ORDER_FULFILLMENT_TONE[r.fulfillmentStatus] ?? 'neutral',
  },
  {
    key: 'paymentMethod',
    header: 'Method',
    kind: 'text',
    value: (r) => r.paymentMethod,
  },
];

/* ─── Component ────────────────────────────────────────────────── */

export interface OrdersClientProps {
  initialRows: SabcrmStoreOrderListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmStoreOrderKpis | null;
  initialFilters?: Partial<DocListFilters>;
}

export function OrdersClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
}: OrdersClientProps): React.JSX.Element {
  const config = React.useMemo<DocListPageConfig<SabcrmStoreOrderListRow>>(
    () => ({
      title: 'Orders',
      description:
        'Customer orders placed against this workspace’s storefronts — payment and fulfilment at a glance.',
      icon: ShoppingCart,
      entity: { singular: 'order', plural: 'orders' },
      columns: COLUMNS,
      statuses: ORDER_PAYMENT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmStoreOrdersPage(toOrderFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmStoreOrderRows(toOrderFilters(filters)),
      csvFileName: 'orders.csv',
      rowHref: (row) => orderDetailHref(row.id),
      rowLabel: (row) => `order ${row.orderNumber}`,
      partyFilter: {
        placeholder: 'Any storefront',
        search: async (q) => {
          const res = await searchSabcrmStorefronts(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-paid',
          label: 'Mark paid',
          icon: CheckCircle2,
          run: async (rows) => {
            const payable = rows.filter(
              (r) => r.paymentStatus === 'pending' || r.paymentStatus === 'failed',
            );
            if (payable.length === 0) {
              return { ok: false, error: 'Only pending or failed orders can be marked paid.' };
            }
            for (const row of payable) {
              const res = await markSabcrmStoreOrderPaid(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'mark-fulfilled',
          label: 'Mark fulfilled',
          icon: PackageCheck,
          run: async (rows) => {
            const fulfillable = rows.filter(
              (r) =>
                r.fulfillmentStatus === 'unfulfilled' ||
                r.fulfillmentStatus === 'partial',
            );
            if (fulfillable.length === 0) {
              return { ok: false, error: 'Those orders are already fulfilled or cancelled.' };
            }
            for (const row of fulfillable) {
              const res = await markSabcrmStoreOrderFulfilled(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'cancel',
          label: 'Cancel',
          icon: PackageX,
          tone: 'danger',
          confirm: {
            title: 'Cancel the selected orders?',
            description:
              'Cancelled orders are flagged as such; their history is preserved.',
            actionLabel: 'Cancel orders',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await cancelSabcrmStoreOrder(row.id);
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
        label="Paid revenue"
        icon={IndianRupee}
        value={formatDocMoney(kpis.paidTotal, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} orders`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'order' : 'orders'}`
        }
      />
      <KpiCard
        label="Pending payment"
        icon={Wallet}
        value={String(kpis.pendingCount)}
        delta={kpis.pendingCount === 1 ? 'order awaiting payment' : 'orders awaiting payment'}
        deltaTone={kpis.pendingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Unfulfilled"
        icon={PackageX}
        value={String(kpis.unfulfilledCount)}
        delta={kpis.unfulfilledCount === 1 ? 'order to ship' : 'orders to ship'}
        deltaTone={kpis.unfulfilledCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="This month"
        icon={CalendarClock}
        value={formatDocMoney(kpis.thisMonthTotal, kpis.currency)}
        delta={`${kpis.thisMonthCount} ${kpis.thisMonthCount === 1 ? 'order' : 'orders'} placed`}
        deltaTone={kpis.thisMonthCount > 0 ? 'up' : 'neutral'}
      />
    </>
  ) : null;

  return (
    <DocListPage
      config={config}
      kpis={kpiStrip}
      primaryAction={
        <Badge tone="neutral">Orders arrive from storefront checkout</Badge>
      }
      initialRows={initialRows}
      initialHasMore={initialHasMore}
      initialError={initialError}
      initialFilters={initialFilters}
    />
  );
}
