'use client';

/**
 * SabCRM Finance — Debit notes list client
 * (`/sabcrm/finance/debit-notes`).
 *
 * Doc-surface adopter per the finance-rollout spec §3.5 — the
 * vendor-side mirror of the credit-notes surface: KPI strip (debited
 * total / cash refunds pending / this month / top reason),
 * config-driven list (vendor labels batch-resolved, reason +
 * refund-mode badges, search + status + vendor + date-range filters,
 * server pagination, bulk actions, CSV export) and the full DocForm
 * drawer (supply-vendor picker, linked-bill picker, reason /
 * refund-mode in `extras`, server-recomputed totals).
 *
 * Supports the `?fromBill=<id>` deep link (the bill detail's "Create
 * debit note" convert): the server page resolves the bill into a
 * prefill and this client opens the create drawer pre-seeded.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  FilePlus2,
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
  DEBIT_NOTE_STATUSES,
  debitNoteDetailHref,
  debitNoteReasonLabel,
  debitNoteRefundModeLabel,
  toDebitNoteFilters,
} from './debit-note-config';
import {
  baseDebitNoteFormConfig,
  readDebitNoteExtras,
  validateDebitNoteExtras,
} from './debit-note-form';

import {
  createSabcrmDebitNoteFull,
  exportSabcrmDebitNoteRows,
  getNextSabcrmDebitNoteNumber,
  listSabcrmDebitNotesPage,
  transitionSabcrmDebitNoteStatus,
} from '@/app/actions/sabcrm-finance-debit-notes.actions';
import { searchSabcrmFinanceVendors } from '@/app/actions/sabcrm-finance-pickers.actions';
import { deleteSabcrmDebitNote } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmDebitNoteKpis,
  SabcrmDebitNoteListRow,
  SabcrmDebitNotePrefill,
} from '@/app/actions/sabcrm-finance-debit-notes.actions.types';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmDebitNoteListRow>[] = [
  { key: 'dnNo', header: 'Number', kind: 'text', value: (r) => r.dnNo },
  {
    key: 'party',
    header: 'Vendor',
    kind: 'party',
    value: (r) => r.vendorLabel,
  },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'reason',
    header: 'Reason',
    kind: 'badge',
    value: (r) => debitNoteReasonLabel(r.reason),
  },
  {
    key: 'refundMode',
    header: 'Refund',
    kind: 'badge',
    value: (r) => debitNoteRefundModeLabel(r.refundMode),
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

export interface DebitNotesClientProps {
  initialRows: SabcrmDebitNoteListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmDebitNoteKpis | null;
  /** Toolbar seed parsed from `searchParams` (statements drill-down). */
  initialFilters?: Partial<DocListFilters>;
  /** Non-null when `?fromBill=<id>` resolved — opens the form seeded. */
  prefill: SabcrmDebitNotePrefill | null;
}

export function DebitNotesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
  prefill,
}: DebitNotesClientProps): React.JSX.Element {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(() => prefill !== null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  // Prefill seed (bill → debit-note convert). Stable identity so the
  // DocForm open-reset effect doesn't refire while the user types.
  const createSeed = React.useMemo<DocFormValues | undefined>(() => {
    if (!prefill) return undefined;
    const base = emptyDocFormValues();
    return {
      ...base,
      partyId: prefill.vendorId || null,
      partyLabel: prefill.vendorLabel,
      currency: prefill.currency,
      extras: {
        ...base.extras,
        linkedBillId: prefill.billId,
        linkedBillLabel: prefill.billLabel,
      },
    };
  }, [prefill]);

  const config = React.useMemo<DocListPageConfig<SabcrmDebitNoteListRow>>(
    () => ({
      title: 'Debit notes',
      description:
        'Debits raised against vendor bills — returns, short-shipments, price adjustments and vendor refunds.',
      icon: FilePlus2,
      entity: { singular: 'debit note', plural: 'debit notes' },
      columns: COLUMNS,
      statuses: DEBIT_NOTE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmDebitNotesPage(toDebitNoteFilters(filters));
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmDebitNoteRows(toDebitNoteFilters(filters)),
      csvFileName: 'debit-notes.csv',
      rowHref: (row) => debitNoteDetailHref(row.id),
      rowLabel: (row) => `debit note ${row.dnNo}`,
      partyFilter: {
        placeholder: 'Any vendor',
        search: async (q) => {
          const res = await searchSabcrmFinanceVendors(q);
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
                error: 'Only draft debit notes can be issued.',
              };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmDebitNoteStatus(
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
            title: 'Delete the selected debit notes?',
            description:
              'This permanently removes them from the workspace. This action cannot be undone.',
            actionLabel: 'Delete debit notes',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmDebitNote(row.id);
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
        label="Debited"
        icon={Wallet}
        value={formatDocMoney(kpis.debitedTotal, kpis.currency)}
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
        delta={`${kpis.refundsPendingCount} issued ${kpis.refundsPendingCount === 1 ? 'note awaits' : 'notes await'} a vendor refund`}
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
        value={kpis.topReason ? debitNoteReasonLabel(kpis.topReason) : '—'}
        delta={
          kpis.topReason
            ? `${kpis.topReasonCount} of ${kpis.count} notes`
            : 'No debit notes yet'
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
            New debit note
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
          ...baseDebitNoteFormConfig(),
          issueLabel: 'Save & issue',
          suggestNumber: async () => {
            const res = await getNextSabcrmDebitNoteNumber();
            return res.ok ? res.data : null;
          },
        }}
        onSubmit={async (values, { issue }) => {
          const extras = readDebitNoteExtras(values.extras);
          const problem = validateDebitNoteExtras(extras);
          if (problem) return { ok: false, error: problem };
          const res = await createSabcrmDebitNoteFull({
            dnNo: values.number,
            vendorId: values.partyId ?? '',
            currency: values.currency,
            date: values.date,
            reason: extras.reason!,
            refundMode: extras.refundMode!,
            refundTxnId: extras.refundTxnId || undefined,
            linkedBillId: extras.linkedBillId ?? undefined,
            lines: values.lines.filter((l) => !isBlankDocLine(l)),
            totalsModifiers: values.modifiers,
            notes: values.customerNotes || undefined,
            issue,
          });
          if (!res.ok) return res;
          if (values.attachments.length > 0) {
            // Engine DTO gap: CreateDebitNoteInput carries no
            // attachments — be honest instead of silently dropping.
            toast.message(
              'Attachments are not persisted on debit notes yet — they were skipped.',
            );
          }
          toast.success(
            issue
              ? `${res.data.dnNo} issued.`
              : `${res.data.dnNo} saved as draft.`,
          );
          setRefreshToken((t) => t + 1);
          router.refresh();
          return { ok: true };
        }}
      />
    </>
  );
}
