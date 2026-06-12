'use client';

/**
 * SabCRM Finance — Sales orders list client
 * (`/sabcrm/finance/sales-orders`).
 *
 * Doc-surface-kit adopter (finance-rollout spec §3.2): KPI strip (open
 * order value / awaiting fulfillment / fulfilled this month / due to
 * ship), config-driven list (typed columns, search + status + customer
 * + date-range filters, server pagination, bulk actions, CSV export)
 * and the full DocForm drawer (quotation link, PO pair, shipment date,
 * delivery method, internal notes, server-recomputed totals).
 *
 * Every row is display-ready: customers render as RESOLVED labels —
 * never a raw ObjectId.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  IndianRupee,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  SALES_ORDER_STATUSES,
  salesOrderDetailHref,
  toSalesOrderFilters,
} from './sales-order-config';
import {
  buildSalesOrderFormConfig,
  parseDeliveryMethod,
  parseExchangeRate,
  readSalesOrderExtras,
} from './sales-order-form';

import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  createSabcrmSalesOrderFull,
  exportSabcrmSalesOrderRows,
  listSabcrmSalesOrdersPage,
  transitionSabcrmSalesOrderStatus,
} from '@/app/actions/sabcrm-finance-sales-orders.actions';
import { deleteSabcrmSalesOrder } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmSalesOrderKpis,
  SabcrmSalesOrderListRow,
} from '@/app/actions/sabcrm-finance-sales-orders.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmSalesOrderListRow>[] = [
  { key: 'soNo', header: 'Number', kind: 'text', value: (r) => r.soNo },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  { key: 'poNo', header: 'PO no.', kind: 'text', value: (r) => r.poNo },
  {
    key: 'expectedShipmentDate',
    header: 'Ship by',
    kind: 'date',
    value: (r) => r.expectedShipmentDate,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
  {
    key: 'total',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface SalesOrdersClientProps {
  initialRows: SabcrmSalesOrderListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmSalesOrderKpis | null;
}

export function SalesOrdersClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: SalesOrdersClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmSalesOrderListRow>>(
    () => ({
      title: 'Sales orders',
      description:
        'Confirmed customer orders — track fulfillment, link quotations and convert into invoices.',
      icon: ShoppingCart,
      entity: { singular: 'sales order', plural: 'sales orders' },
      columns: COLUMNS,
      statuses: SALES_ORDER_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSalesOrdersPage(
          toSalesOrderFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSalesOrderRows(toSalesOrderFilters(filters)),
      csvFileName: 'sales-orders.csv',
      rowHref: (row) => salesOrderDetailHref(row.id),
      rowLabel: (row) => `sales order ${row.soNo}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-fulfilled',
          label: 'Mark fulfilled',
          icon: PackageCheck,
          run: async (rows) => {
            const eligible = rows.filter(
              (r) => r.status === 'open' || r.status === 'partial',
            );
            if (eligible.length === 0) {
              return {
                ok: false,
                error: 'Only open or partial orders can be fulfilled.',
              };
            }
            for (const row of eligible) {
              const res = await transitionSabcrmSalesOrderStatus(
                row.id,
                'fulfilled',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'cancel',
          label: 'Cancel',
          icon: XCircle,
          run: async (rows) => {
            const eligible = rows.filter((r) => r.status === 'open');
            if (eligible.length === 0) {
              return { ok: false, error: 'Only open orders can be cancelled.' };
            }
            for (const row of eligible) {
              const res = await transitionSabcrmSalesOrderStatus(
                row.id,
                'cancelled',
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
            title: 'Delete the selected sales orders?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete sales orders',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSalesOrder(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  const formConfig = React.useMemo(
    () => buildSalesOrderFormConfig({ mode: 'create' }),
    [],
  );

  const kpiStrip = kpis ? (
    <>
      <KpiCard
        label="Open order value"
        icon={IndianRupee}
        value={formatDocMoney(kpis.openValue, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} orders`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'order' : 'orders'}`
        }
      />
      <KpiCard
        label="Awaiting fulfillment"
        icon={Truck}
        value={String(kpis.awaitingCount)}
        delta={kpis.awaitingCount === 1 ? 'open or partial order' : 'open or partial orders'}
        deltaTone={kpis.awaitingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Fulfilled this month"
        icon={PackageCheck}
        value={String(kpis.fulfilledThisMonth)}
        delta="Orders completed"
        deltaTone={kpis.fulfilledThisMonth > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Due to ship in 7 days"
        icon={CalendarClock}
        value={String(kpis.dueToShipCount)}
        delta={kpis.dueToShipCount === 1 ? 'order on the clock' : 'orders on the clock'}
        deltaTone={kpis.dueToShipCount > 0 ? 'down' : 'neutral'}
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
            New sales order
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
        config={formConfig}
        onSubmit={async (values) => {
          // The SO wire shape has no terms/attachments slots — refuse
          // loudly instead of dropping typed content silently.
          if (values.termsAndConditions.trim()) {
            return {
              ok: false,
              error:
                "Sales orders don't store terms & conditions yet — clear that field (use Customer notes instead).",
            };
          }
          if (values.attachments.length > 0) {
            return {
              ok: false,
              error:
                "Sales orders don't store attachments yet — remove them to save.",
            };
          }
          const extras = readSalesOrderExtras(values);
          const res = await createSabcrmSalesOrderFull({
            soNo: values.number,
            clientId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            quotationRef: extras.quotationRef || undefined,
            poNo: extras.poNo || undefined,
            poDate: extras.poDate || undefined,
            expectedShipmentDate: extras.expectedShipmentDate || undefined,
            deliveryMethod: parseDeliveryMethod(extras.deliveryMethod),
            paymentTerms: values.paymentTerms || undefined,
            exchangeRate: parseExchangeRate(extras.exchangeRate),
            customerNotes: values.customerNotes || undefined,
            internalNotes: extras.internalNotes || undefined,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.soNo} created.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
