'use client';

/**
 * SabCRM Finance — Credit notes list client
 * (`/sabcrm/finance/credit-notes`).
 *
 * Doc-surface adopter per the finance-rollout spec §3.4: KPI strip
 * (credited total / cash refunds pending / this month / top reason),
 * config-driven list (typed columns incl. reason + refund-mode badges,
 * search + status + customer + date-range filters, server pagination,
 * bulk actions, CSV export) and the full DocForm drawer (real customer
 * picker, linked-invoice picker, reason / refund-mode / switches in
 * `extras`, server-recomputed totals).
 *
 * Supports the `?fromInvoice=<id>` deep link: the server page resolves
 * the invoice into a prefill and this client opens the create drawer
 * pre-seeded (linked invoice + customer + currency).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  FileMinus2,
  Plus,
  Send,
  Tags,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocForm,
  DocListPage,
  emptyDocFormValues,
  formatDocMoney,
  type DocFormValues,
  type DocListColumn,
  type DocListFilters,
  type DocListPageConfig,
} from '../_components/doc-surface';
import {
  CREDIT_NOTE_STATUSES,
  creditNoteDetailHref,
  creditNoteReasonLabel,
  creditNoteRefundModeLabel,
  toCreditNoteFilters,
} from './credit-note-config';
import {
  baseCreditNoteFormConfig,
  readCreditNoteExtras,
  validateCreditNoteExtras,
} from './credit-note-form';

import {
  createSabcrmCreditNoteFull,
  exportSabcrmCreditNoteRows,
  getNextSabcrmCreditNoteNumber,
  listSabcrmCreditNotesPage,
  transitionSabcrmCreditNoteStatus,
} from '@/app/actions/sabcrm-finance-credit-notes.actions';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { deleteSabcrmCreditNote } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmCreditNoteKpis,
  SabcrmCreditNoteListRow,
  SabcrmCreditNotePrefill,
} from '@/app/actions/sabcrm-finance-credit-notes.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmCreditNoteListRow>[] = [
  { key: 'cnNo', header: 'Number', kind: 'text', value: (r) => r.cnNo },
  {
    key: 'party',
    header: 'Customer',
    kind: 'party',
    value: (r) => r.partyLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'reason',
    header: 'Reason',
    kind: 'badge',
    value: (r) => creditNoteReasonLabel(r.reason),
  },
  {
    key: 'refundMode',
    header: 'Refund',
    kind: 'badge',
    value: (r) => creditNoteRefundModeLabel(r.refundMode),
    tone: (r) => (r.refundMode === 'cash' ? 'warning' : 'neutral'),
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
  {
    key: 'total',
    header: 'Amount',
    kind: 'money',
    value: (r) => r.total,
    currency: (r) => r.currency,
  },
];

/* ─── Component ───────────────────────────────────────────────── */

export interface CreditNotesClientProps {
  initialRows: SabcrmCreditNoteListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmCreditNoteKpis | null;
  /** Toolbar seed parsed from `searchParams` (statements drill-down). */
  initialFilters?: Partial<DocListFilters>;
  /** Non-null when `?fromInvoice=<id>` resolved — opens the form seeded. */
  prefill: SabcrmCreditNotePrefill | null;
}

export function CreditNotesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
  prefill,
}: CreditNotesClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(() => prefill !== null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  // Prefill seed (invoice → credit-note deep link). Stable identity so
  // the DocForm open-reset effect doesn't refire while the user types.
  const createSeed = React.useMemo<DocFormValues | undefined>(() => {
    if (!prefill) return undefined;
    const base = emptyDocFormValues();
    return {
      ...base,
      partyId: prefill.clientId || null,
      partyLabel: prefill.clientLabel,
      currency: prefill.currency,
      extras: {
        ...base.extras,
        linkedInvoiceId: prefill.invoiceId,
        linkedInvoiceLabel: prefill.invoiceLabel,
      },
    };
  }, [prefill]);

  const config = React.useMemo<DocListPageConfig<SabcrmCreditNoteListRow>>(
    () => ({
      title: 'Credit notes',
      description:
        'Credits issued against customer invoices — returns, discounts, adjustments and refunds.',
      icon: FileMinus2,
      entity: { singular: 'credit note', plural: 'credit notes' },
      columns: COLUMNS,
      statuses: CREDIT_NOTE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmCreditNotesPage(toCreditNoteFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmCreditNoteRows(toCreditNoteFilters(filters)),
      csvFileName: 'credit-notes.csv',
      rowHref: (row) => creditNoteDetailHref(row.id),
      rowLabel: (row) => `credit note ${row.cnNo}`,
      partyFilter: {
        placeholder: 'Any customer',
        search: async (q) => {
          const res = await searchSabcrmFinanceParties(q);
          return res.ok ? res.data : [];
        },
      },
      bulkActions: [
        {
          key: 'mark-issued',
          label: 'Mark as issued',
          icon: Send,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return {
                ok: false,
                error: 'Only draft credit notes can be issued.',
              };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmCreditNoteStatus(
                row.id,
                'issued',
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
            title: 'Delete the selected credit notes?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete credit notes',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmCreditNote(row.id);
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
        label="Credited"
        icon={Wallet}
        value={formatDocMoney(kpis.creditedTotal, kpis.currency)}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} notes`
            : `Across ${kpis.count} ${kpis.count === 1 ? 'note' : 'notes'}`
        }
      />
      <KpiCard
        label="Cash refunds pending"
        icon={Undo2}
        value={formatDocMoney(kpis.refundsPendingAmount, kpis.currency)}
        delta={`${kpis.refundsPendingCount} issued ${kpis.refundsPendingCount === 1 ? 'note awaits' : 'notes await'} a refund`}
        deltaTone={kpis.refundsPendingCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="This month"
        icon={CalendarClock}
        value={formatDocMoney(kpis.thisMonthTotal, kpis.currency)}
        delta={`${kpis.thisMonthCount} ${kpis.thisMonthCount === 1 ? 'note' : 'notes'} raised`}
        deltaTone={kpis.thisMonthCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Top reason"
        icon={Tags}
        value={kpis.topReason ? creditNoteReasonLabel(kpis.topReason) : '—'}
        delta={
          kpis.topReason
            ? `${kpis.topReasonCount} of ${kpis.count} notes`
            : 'No credit notes yet'
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
            New credit note
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
        initialValues={createSeed}
        config={{
          ...baseCreditNoteFormConfig(),
          issueLabel: 'Save & issue',
          suggestNumber: async () => {
            const res = await getNextSabcrmCreditNoteNumber();
            return res.ok ? res.data : null;
          },
        }}
        onSubmit={async (values, { issue }) => {
          const extras = readCreditNoteExtras(values.extras);
          const problem = validateCreditNoteExtras(extras);
          if (problem) return { ok: false, error: problem };
          const res = await createSabcrmCreditNoteFull({
            cnNo: values.number,
            clientId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            reason: extras.reason!,
            refundMode: extras.refundMode!,
            refundTxnId: extras.refundTxnId || undefined,
            taxRecalc: extras.taxRecalc,
            autoApply: extras.autoApply,
            linkedInvoiceId: extras.linkedInvoiceId ?? undefined,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            notes: values.customerNotes || undefined,
            issue,
          });
          if (!res.ok) return res;
          if (values.attachments.length > 0) {
            // Engine DTO gap: CreateCreditNoteInput carries no
            // attachments — be honest instead of silently dropping.
            toast.message(
              'Attachments are not persisted on credit notes yet — they were skipped.',
            );
          }
          toast.success(
            issue
              ? `${res.data.cnNo} issued.`
              : `${res.data.cnNo} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
