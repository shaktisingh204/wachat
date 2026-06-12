'use client';

/**
 * SabCRM Finance — Invoices list client (`/sabcrm/finance/invoices`).
 *
 * The flagship adopter of the doc-surface kit: KPI strip (total
 * invoiced / outstanding / overdue / this month), config-driven list
 * (typed columns, search + status + customer + date-range filters,
 * server pagination, bulk actions, CSV export) and the full DocForm
 * drawer (real customer picker over the records engine, real supply
 * items, server-recomputed totals, SabFiles attachments).
 *
 * Every row is display-ready: customers render as RESOLVED labels —
 * never a raw ObjectId — and the kit's empty/error states handle the
 * first-run and engine-down cases.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarClock,
  IndianRupee,
  Plus,
  ReceiptText,
  Send,
  Trash2,
  Wallet,
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
  INVOICE_STATUSES,
  invoiceDetailHref,
  toInvoiceFilters,
} from './invoice-config';

import {
  createSabcrmInvoiceFull,
  exportSabcrmInvoiceRows,
  getNextSabcrmInvoiceNumber,
  listSabcrmInvoicesPage,
  searchSabcrmFinanceItems,
  searchSabcrmFinanceParties,
  transitionSabcrmInvoiceStatus,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { deleteSabcrmInvoice } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmInvoiceKpis,
  SabcrmInvoiceListRow,
} from '@/app/actions/sabcrm-finance-invoices.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmInvoiceListRow>[] = [
  {
    key: 'invoiceNo',
    header: 'Number',
    kind: 'text',
    value: (r) => r.invoiceNo,
  },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  { key: 'dueDate', header: 'Due', kind: 'date', value: (r) => r.dueDate },
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
  {
    key: 'balance',
    header: 'Balance',
    kind: 'money',
    value: (r) => r.balance,
    currency: (r) => r.currency,
  },
  {
    key: 'aging',
    header: 'Aging',
    kind: 'aging',
    value: (r) => r.agingDays,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface InvoicesClientProps {
  initialRows: SabcrmInvoiceListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmInvoiceKpis | null;
}

export function InvoicesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
}: InvoicesClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmInvoiceListRow>>(
    () => ({
      title: 'Invoices',
      description:
        'Billing documents for this workspace — search, filter, issue, collect and export.',
      icon: ReceiptText,
      entity: { singular: 'invoice', plural: 'invoices' },
      columns: COLUMNS,
      statuses: INVOICE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmInvoicesPage(toInvoiceFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmInvoiceRows(toInvoiceFilters(filters)),
      csvFileName: 'invoices.csv',
      rowHref: (row) => invoiceDetailHref(row.id),
      rowLabel: (row) => `invoice ${row.invoiceNo}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-sent',
          label: 'Mark as sent',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return { ok: false, error: 'Only draft invoices can be issued.' };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmInvoiceStatus(row.id, 'sent');
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
            title: 'Delete the selected invoices?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete invoices',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmInvoice(row.id);
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
        label="Total invoiced"
        icon={IndianRupee}
        value={formatDocMoney(kpis.totalInvoiced, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} invoices`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'invoice' : 'invoices'}`
        }
      />
      <KpiCard
        label="Outstanding"
        icon={Wallet}
        value={formatDocMoney(kpis.outstanding, kpis.currency)}
        delta="Awaiting payment"
        deltaTone={kpis.outstanding > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Overdue"
        icon={AlertTriangle}
        value={String(kpis.overdueCount)}
        delta={kpis.overdueCount === 1 ? 'invoice past due' : 'invoices past due'}
        deltaTone={kpis.overdueCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="This month"
        icon={CalendarClock}
        value={formatDocMoney(kpis.thisMonthTotal, kpis.currency)}
        delta={`${kpis.thisMonthCount} ${kpis.thisMonthCount === 1 ? 'invoice' : 'invoices'} issued`}
        deltaTone={kpis.thisMonthCount > 0 ? 'up' : 'neutral'}
      />
    </>
  ) : null;

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button variant="primary" iconLeft={Plus} onClick={() => setFormOpen(true)}>
            New invoice
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
        config={{
          entitySingular: 'Invoice',
          numberLabel: 'Invoice number',
          partyLabel: 'Customer',
          partyPlaceholder: 'Search companies & people…',
          dateLabel: 'Invoice date',
          dueDateLabel: 'Due date',
          issueLabel: 'Save & issue',
          searchParties: async (q) => {
            const res = await searchSabcrmFinanceParties(q);
            return res.ok ? res.data : [];
          },
          searchItems: async (q) => {
            const res = await searchSabcrmFinanceItems(q);
            if (!res.ok) return [];
            return res.data.map((item) => ({
              id: item.id,
              label: item.name,
              meta: item.sku
                ? `${item.sku} · ${formatDocMoney(item.sellingPrice, item.currency ?? 'INR')}`
                : formatDocMoney(item.sellingPrice, item.currency ?? 'INR'),
              rate: item.sellingPrice,
              taxRatePct: item.taxRate,
              hsnSac: item.hsnSac,
              description: item.description ?? item.name,
            }));
          },
          suggestNumber: async () => {
            const res = await getNextSabcrmInvoiceNumber();
            return res.ok ? res.data : null;
          },
        }}
        onSubmit={async (values, { issue }) => {
          const res = await createSabcrmInvoiceFull({
            invoiceNo: values.number,
            clientId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            dueDate: values.dueDate,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            paymentTerms: values.paymentTerms || undefined,
            customerNotes: values.customerNotes || undefined,
            termsAndConditions: values.termsAndConditions || undefined,
            attachments: values.attachments,
            issue,
          });
          if (!res.ok) return res;
          toast.success(
            issue
              ? `${res.data.invoiceNo} issued.`
              : `${res.data.invoiceNo} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
