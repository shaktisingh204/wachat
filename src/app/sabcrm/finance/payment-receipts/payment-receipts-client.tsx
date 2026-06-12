'use client';

/**
 * SabCRM Finance — Payment receipts list client
 * (`/sabcrm/finance/payment-receipts`).
 *
 * Doc-surface adopter (finance-rollout spec §3.7): KPI strip (collected
 * this month / uncleared / bounced / TDS FY-to-date), config-driven
 * list (resolved customer labels, mode badges, search + status +
 * customer + date filters, server pagination, bulk actions, CSV
 * export) and the full DocForm drawer with the receipt's extras —
 * mode, deposit account, amount, FX, cheque/txn identifiers, TDS +
 * bank charges, excess-as-advance and the invoice AllocationsEditor.
 *
 * The receipt has no line items / due date / payment terms — the form
 * runs with `hideLines`, `hideDueDate`, `hidePaymentTerms`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  IndianRupee,
  Landmark,
  Plus,
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
} from '../_components/doc-surface';
import {
  RECEIPT_STATUSES,
  receiptDetailHref,
  receiptModeLabel,
  toReceiptFilters,
  readReceiptExtras,
} from './receipt-config';
import { buildReceiptExtraFields } from './receipt-form-extras';

import {
  createSabcrmPaymentReceiptFull,
  exportSabcrmPaymentReceiptRows,
  getNextSabcrmPaymentReceiptNumber,
  listSabcrmPaymentReceiptsPage,
  transitionSabcrmPaymentReceiptStatus,
} from '@/app/actions/sabcrm-finance-payment-receipts.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { deleteSabcrmPaymentReceipt } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmReceiptKpis,
  SabcrmReceiptListRow,
} from '@/app/actions/sabcrm-finance-payment-receipts.actions.types';
import type { SabcrmPaymentAccountOption } from '@/app/actions/sabcrm-finance-invoices.actions.types';
import type { CrmPaymentMode } from '@/lib/rust-client/crm-payment-receipts';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns (spec §3.7: number, customer, date, mode, amount, status) ── */

const COLUMNS: DocListColumn<SabcrmReceiptListRow>[] = [
  {
    key: 'receiptNo',
    header: 'Number',
    kind: 'text',
    value: (r) => r.receiptNo,
  },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'mode',
    header: 'Mode',
    kind: 'badge',
    value: (r) => receiptModeLabel(r.mode),
    tone: () => 'neutral',
  },
  {
    key: 'account',
    header: 'Deposit to',
    kind: 'party',
    value: (r) => r.bankAccountLabel,
  },
  {
    key: 'amount',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.amount,
    currency: (r) => r.currency,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'status',
    value: (r) => r.status,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface PaymentReceiptsClientProps {
  initialRows: SabcrmReceiptListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmReceiptKpis | null;
  /** Payment-account Select options (REAL ids, resolved server-side). */
  accounts: SabcrmPaymentAccountOption[];
  /** Statements drill-down deep-link seed (parsed from searchParams). */
  initialFilters?: Partial<DocListFilters>;
}

export function PaymentReceiptsClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  accounts,
  initialFilters,
}: PaymentReceiptsClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const config = React.useMemo<DocListPageConfig<SabcrmReceiptListRow>>(
    () => ({
      title: 'Payment receipts',
      description:
        'Money received from customers — record, allocate to invoices, clear and export.',
      icon: Banknote,
      entity: { singular: 'receipt', plural: 'receipts' },
      columns: COLUMNS,
      statuses: RECEIPT_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmPaymentReceiptsPage(
          toReceiptFilters(filters),
        );
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmPaymentReceiptRows(toReceiptFilters(filters)),
      csvFileName: 'payment-receipts.csv',
      rowHref: (row) => receiptDetailHref(row.id),
      rowLabel: (row) => `receipt ${row.receiptNo}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-cleared',
          label: 'Mark cleared',
          icon: CheckCircle2,
          run: async (rows) => {
            const pending = rows.filter((r) => r.status === 'received');
            if (pending.length === 0) {
              return {
                ok: false,
                error: 'Only received (uncleared) receipts can be cleared.',
              };
            }
            for (const row of pending) {
              const res = await transitionSabcrmPaymentReceiptStatus(
                row.id,
                'cleared',
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
            title: 'Delete the selected receipts?',
            description:
              'This permanently removes them from the workspace. Invoice balances already updated by these receipts are NOT rolled back.',
            actionLabel: 'Delete receipts',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmPaymentReceipt(row.id);
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
        label="Collected this month"
        icon={IndianRupee}
        value={formatDocMoney(kpis.collectedThisMonth, kpis.currency)}
        delta={`${kpis.collectedThisMonthCount} ${kpis.collectedThisMonthCount === 1 ? 'receipt' : 'receipts'}`}
        deltaTone={kpis.collectedThisMonthCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Uncleared"
        icon={Landmark}
        value={formatDocMoney(kpis.unclearedTotal, kpis.currency)}
        delta={`${kpis.unclearedCount} awaiting clearance`}
        deltaTone={kpis.unclearedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Bounced"
        icon={AlertTriangle}
        value={String(kpis.bouncedCount)}
        delta={kpis.bouncedCount === 1 ? 'receipt bounced' : 'receipts bounced'}
        deltaTone={kpis.bouncedCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="TDS this FY"
        icon={Banknote}
        value={formatDocMoney(kpis.tdsFyToDate, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} receipts`
            : 'Deducted at source'
        }
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
            New receipt
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={initialFilters}
      />

      <DocForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode="create"
        config={{
          entitySingular: 'Receipt',
          numberLabel: 'Receipt number',
          partyLabel: 'Customer',
          partyPlaceholder: 'Search companies & people…',
          dateLabel: 'Receipt date',
          dueDateLabel: 'Due date',
          hideDueDate: true,
          hideLines: true,
          hidePaymentTerms: true,
          notesLabel: 'Notes',
          searchParties: async (q) => {
            const res = await searchSabcrmFinanceParties(q);
            return res.ok ? res.data : [];
          },
          suggestNumber: async () => {
            const res = await getNextSabcrmPaymentReceiptNumber();
            return res.ok ? res.data : null;
          },
          extraFields: buildReceiptExtraFields({ accounts, locked: false }),
        }}
        onSubmit={async (values) => {
          const extras = readReceiptExtras(values.extras);
          if (!extras.mode) {
            return { ok: false, error: 'Pick a payment mode.' };
          }
          if (!extras.bankAccountId) {
            return {
              ok: false,
              error:
                accounts.length === 0
                  ? 'Create a payment account first (Finance → Payment accounts) so the money lands in a real account.'
                  : 'Pick the account that received this payment.',
            };
          }
          const amount = safeNum(extras.amount);
          if (amount <= 0) {
            return { ok: false, error: 'Amount must be greater than zero.' };
          }
          // Allocation rows: ignore fully blank rows, reject half-filled.
          const meaningful = extras.allocations.filter(
            (row) => row.docId || safeNum(row.amount) > 0,
          );
          for (const row of meaningful) {
            if (!row.docId) {
              return {
                ok: false,
                error: 'Pick an invoice for every allocation row.',
              };
            }
            if (safeNum(row.amount) <= 0) {
              return {
                ok: false,
                error: 'Every allocation amount must be greater than zero.',
              };
            }
          }
          const res = await createSabcrmPaymentReceiptFull({
            receiptNo: values.number,
            date: values.date,
            clientId: values.partyId ?? '',
            mode: extras.mode as CrmPaymentMode,
            bankAccountId: extras.bankAccountId,
            amount,
            currency: values.currency,
            exchangeRate: extras.exchangeRate
              ? safeNum(extras.exchangeRate)
              : undefined,
            chequeNo: extras.chequeNo || undefined,
            chequeDate: extras.chequeDate || undefined,
            txnId: extras.txnId || undefined,
            reference: extras.reference || undefined,
            applyTo: meaningful.map((row) => ({
              invoiceId: row.docId as string,
              amount: safeNum(row.amount),
            })),
            excessAsAdvance: extras.excessAsAdvance,
            tdsDeducted: extras.tdsDeducted
              ? safeNum(extras.tdsDeducted)
              : undefined,
            bankCharges: extras.bankCharges
              ? safeNum(extras.bankCharges)
              : undefined,
            notes: values.customerNotes || undefined,
            attachments: values.attachments,
          });
          if (!res.ok) return res;
          toast.success(`${res.data.receiptNo} recorded.`);
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
