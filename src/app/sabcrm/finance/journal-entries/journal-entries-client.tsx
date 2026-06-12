'use client';

/**
 * SabCRM Finance — Journal entries list client
 * (`/sabcrm/finance/journal-entries`), doc-surface kit adopter.
 *
 * Full multi-leg surface for voucher entries (spec §3.14):
 *
 *   - KPI strip (posted this month / drafts / debit volume / books in
 *     use);
 *   - kit list — typed columns with the voucher BOOK resolved to its
 *     name (never an ObjectId), the kit's party slot repurposed as the
 *     book filter (deep-linked from the books surface via `?book=`),
 *     search + status + date filters, server pagination, bulk
 *     post/archive, CSV export;
 *   - FULL drawer form (`journal-entry-form.tsx`) with the kit's
 *     JournalLinesEditor over the chart of accounts;
 *   - detail VIEW dialog (`?view=<id>` deep link) with the StatusFlow
 *     rail, resolved debit/credit tables and post / edit / archive
 *     actions — posted entries are immutable.
 */

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  BookMarked,
  CheckCircle2,
  FileEdit,
  NotebookPen,
  Plus,
  Scale,
} from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Spinner,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  toast,
} from '@/components/sabcrm/20ui';
import { KpiCard } from '@/components/sabcrm/20ui/composites/charts';

import {
  DocListPage,
  StatusFlow,
  blankJournalLeg,
  formatDocDate,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
  type JournalLeg,
} from '../_components/doc-surface';
import type {
  DocEntityOption,
  DocListFilters,
} from '../_components/doc-surface/types';
import {
  JOURNAL_ENTRIES_PATH,
  JOURNAL_ENTRY_FLOW,
  JOURNAL_ENTRY_STATUSES,
  toJournalEntryFilters,
} from './journal-entry-config';
import {
  JournalEntryForm,
  emptyJournalEntryValues,
  type JournalEntryFormValues,
} from './_components/journal-entry-form';

import {
  createSabcrmJournalEntryFull,
  exportSabcrmJournalEntryRows,
  getNextSabcrmJournalEntryNumber,
  getSabcrmJournalEntryDetail,
  listSabcrmJournalEntriesPage,
  transitionSabcrmJournalEntryStatus,
  updateSabcrmJournalEntryFull,
} from '@/app/actions/sabcrm-finance-journal-entries.actions';
import {
  listSabcrmVoucherBookOptions,
  searchSabcrmFinanceLedgerAccounts,
} from '@/app/actions/sabcrm-finance-pickers.actions';
import { deleteSabcrmJournalEntry } from '@/app/actions/sabcrm-finance.actions';
import type {
  SabcrmJournalEntryDetail,
  SabcrmJournalEntryKpis,
  SabcrmJournalEntryListRow,
  SabcrmJournalLegDetail,
} from '@/app/actions/sabcrm-finance-journal-entries.actions.types';

/* ─── Columns ─────────────────────────────────────────────────── */

const COLUMNS: DocListColumn<SabcrmJournalEntryListRow>[] = [
  {
    key: 'voucherNumber',
    header: 'Voucher',
    kind: 'text',
    value: (r) => r.voucherNumber,
  },
  { key: 'book', header: 'Book', kind: 'party', value: (r) => r.bookLabel },
  { key: 'date', header: 'Date', kind: 'date', value: (r) => r.date },
  {
    key: 'narration',
    header: 'Narration',
    kind: 'text',
    value: (r) => r.narration,
  },
  { key: 'legs', header: 'Legs', kind: 'text', value: (r) => r.legsSummary },
  {
    key: 'totalDebit',
    header: 'Debit',
    kind: 'money',
    value: (r) => r.totalDebit,
  },
  {
    key: 'totalCredit',
    header: 'Credit',
    kind: 'money',
    value: (r) => r.totalCredit,
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Detail → form seeding ───────────────────────────────────── */

function legToRow(leg: SabcrmJournalLegDetail): JournalLeg {
  return {
    ...blankJournalLeg(),
    accountId: leg.accountId,
    accountLabel: leg.accountLabel ?? 'Unknown account',
    amount: leg.amount,
    description: leg.description,
  };
}

function valuesFromDetail(
  detail: SabcrmJournalEntryDetail,
): JournalEntryFormValues {
  return {
    voucherBookId: detail.bookId,
    voucherNumber: detail.voucherNumber,
    date: (detail.date ?? '').slice(0, 10),
    reference: detail.reference,
    narration: detail.narration,
    debits: detail.debits.map(legToRow),
    credits: detail.credits.map(legToRow),
  };
}

function legsToInput(legs: JournalLeg[]) {
  return legs.map((l) => ({
    accountId: l.accountId ?? '',
    amount: l.amount,
    description: l.description,
  }));
}

/* ─── Leg table (view dialog) ─────────────────────────────────── */

function LegTable({
  caption,
  legs,
}: {
  caption: string;
  legs: SabcrmJournalLegDetail[];
}): React.JSX.Element {
  return (
    <div>
      <h4 className="mb-1 text-sm font-medium">{caption}</h4>
      <Table>
        <THead>
          <Tr>
            <Th>Account</Th>
            <Th>Description</Th>
            <Th align="right">Amount</Th>
          </Tr>
        </THead>
        <TBody>
          {legs.map((leg, i) => (
            <Tr key={`${leg.accountId}-${i}`}>
              <Td>
                {leg.accountLabel ?? (
                  <span className="fdoc-unknown-party">Unknown account</span>
                )}
                {leg.accountMeta ? (
                  <span className="ml-2 text-xs opacity-60">
                    {leg.accountMeta}
                  </span>
                ) : null}
              </Td>
              <Td>{leg.description || '—'}</Td>
              <Td align="right">{formatDocMoney(leg.amount, 'INR')}</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────── */

export interface JournalEntriesClientProps {
  initialRows: SabcrmJournalEntryListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  kpis: SabcrmJournalEntryKpis | null;
  /** Toolbar seed (the books surface deep-links `?book=<id>`). */
  initialFilters?: Partial<DocListFilters>;
  /** Resolved label for a seeded book filter (toolbar display). */
  initialBookLabel?: string | null;
}

export function JournalEntriesClient({
  initialRows,
  initialHasMore,
  initialError,
  kpis,
  initialFilters,
  initialBookLabel,
}: JournalEntriesClientProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewId = searchParams.get('view');

  const [refreshToken, setRefreshToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
  const [formSeed, setFormSeed] = React.useState<JournalEntryFormValues>();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [bookOptions, setBookOptions] = React.useState<DocEntityOption[]>([]);

  const [viewOpen, setViewOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<SabcrmJournalEntryDetail | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState(false);

  // Active voucher books for the form's Select (+ create prefill).
  React.useEffect(() => {
    let cancelled = false;
    void listSabcrmVoucherBookOptions().then((res) => {
      if (!cancelled && res.ok) setBookOptions(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // `?view=<id>` deep link → open the detail dialog.
  React.useEffect(() => {
    if (!viewId) return;
    setViewOpen(true);
    setDetailLoading(true);
    let cancelled = false;
    void getSabcrmJournalEntryDetail(viewId).then((res) => {
      if (cancelled) return;
      setDetailLoading(false);
      if (res.ok) setDetail(res.data);
      else {
        toast.error(res.error);
        setViewOpen(false);
        router.replace(pathname, { scroll: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [viewId, pathname, router]);

  const closeView = React.useCallback((): void => {
    setViewOpen(false);
    setDetail(null);
    if (viewId) router.replace(pathname, { scroll: false });
  }, [viewId, pathname, router]);

  const refresh = (): void => {
    setRefreshToken((t) => t + 1);
    router.refresh();
  };

  const openCreate = (): void => {
    setFormMode('create');
    setEditingId(null);
    const seed = emptyJournalEntryValues();
    // A seeded book filter prefills the form's book.
    if (initialFilters?.partyId) seed.voucherBookId = initialFilters.partyId;
    setFormSeed(seed);
    setFormOpen(true);
  };

  const openEdit = (d: SabcrmJournalEntryDetail): void => {
    if (d.status !== 'draft') {
      toast.error('Posted entries are immutable.');
      return;
    }
    setFormMode('edit');
    setEditingId(d.id);
    setFormSeed(valuesFromDetail(d));
    setViewOpen(false);
    setFormOpen(true);
  };

  const postEntry = async (id: string): Promise<void> => {
    setActionBusy(true);
    try {
      const res = await transitionSabcrmJournalEntryStatus(id, 'posted');
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data.voucherNumber} posted.`);
      closeView();
      refresh();
    } finally {
      setActionBusy(false);
    }
  };

  const archiveEntry = async (id: string): Promise<void> => {
    setActionBusy(true);
    try {
      const res = await deleteSabcrmJournalEntry(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Entry archived.');
      closeView();
      refresh();
    } finally {
      setActionBusy(false);
    }
  };

  const config = React.useMemo<DocListPageConfig<SabcrmJournalEntryListRow>>(
    () => ({
      title: 'Journal entries',
      description:
        'Multi-leg voucher entries — balanced debits and credits over the chart of accounts.',
      icon: NotebookPen,
      entity: { singular: 'journal entry', plural: 'journal entries' },
      columns: COLUMNS,
      statuses: JOURNAL_ENTRY_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmJournalEntriesPage(
          toJournalEntryFilters(filters),
        );
        return res.ok
          ? {
              ok: true,
              data: { rows: res.data.rows, hasMore: res.data.hasMore },
            }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmJournalEntryRows(toJournalEntryFilters(filters)),
      csvFileName: 'journal-entries.csv',
      rowHref: (row) =>
        `${JOURNAL_ENTRIES_PATH}?view=${encodeURIComponent(row.id)}`,
      rowLabel: (row) => `journal entry ${row.voucherNumber}`,
      partyFilter: {
        placeholder: 'Any voucher book',
        search: async (q) => {
          const res = await listSabcrmVoucherBookOptions();
          if (!res.ok) return [];
          const needle = q.trim().toLowerCase();
          return needle
            ? res.data.filter((b) =>
                b.label.toLowerCase().includes(needle),
              )
            : res.data;
        },
      },
      bulkActions: [
        {
          key: 'post',
          label: 'Post drafts',
          icon: CheckCircle2,
          run: async (rows) => {
            const drafts = rows.filter((r) => r.status === 'draft');
            if (drafts.length === 0) {
              return { ok: false, error: 'Only draft entries can be posted.' };
            }
            for (const row of drafts) {
              const res = await transitionSabcrmJournalEntryStatus(
                row.id,
                'posted',
              );
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
        {
          key: 'archive',
          label: 'Archive',
          icon: Archive,
          tone: 'danger',
          confirm: {
            title: 'Archive the selected entries?',
            description:
              'Archived entries leave the books but are kept for audit.',
            actionLabel: 'Archive entries',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmJournalEntry(row.id);
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
        label="Posted this month"
        icon={CheckCircle2}
        value={String(kpis.postedThisMonthCount)}
        delta={
          kpis.postedThisMonthCount === 1 ? 'entry posted' : 'entries posted'
        }
        deltaTone={kpis.postedThisMonthCount > 0 ? 'up' : 'neutral'}
      />
      <KpiCard
        label="Drafts"
        icon={FileEdit}
        value={String(kpis.draftCount)}
        delta="awaiting posting"
        deltaTone={kpis.draftCount > 0 ? 'down' : 'neutral'}
      />
      <KpiCard
        label="Debit volume (month)"
        icon={Scale}
        value={formatDocMoney(kpis.debitVolumeThisMonth, 'INR')}
        delta={
          kpis.sampled
            ? `Across the latest ${kpis.count} entries`
            : 'Posted entries this month'
        }
      />
      <KpiCard
        label="Books in use"
        icon={BookMarked}
        value={String(kpis.booksInUse)}
        delta={`${kpis.count} ${kpis.count === 1 ? 'entry' : 'entries'} scanned`}
      />
    </>
  ) : null;

  const seededFilters = React.useMemo<Partial<DocListFilters> | undefined>(
    () => initialFilters,
    [initialFilters],
  );

  return (
    <>
      <DocListPage
        config={config}
        kpis={kpiStrip}
        primaryAction={
          <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
            New journal entry
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
        initialFilters={seededFilters}
      />
      {initialBookLabel ? (
        <span className="sr-only">Filtered to book {initialBookLabel}</span>
      ) : null}

      <JournalEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        bookOptions={bookOptions}
        searchAccounts={async (q) => {
          const res = await searchSabcrmFinanceLedgerAccounts(q);
          return res.ok ? res.data : [];
        }}
        suggestNumber={async (voucherBookId) => {
          const res = await getNextSabcrmJournalEntryNumber(
            voucherBookId ?? undefined,
          );
          return res.ok ? res.data : null;
        }}
        initialValues={formSeed}
        onSubmit={async (values, { post }) => {
          const payload = {
            voucherBookId: values.voucherBookId ?? undefined,
            voucherNumber: values.voucherNumber,
            date: values.date,
            narration: values.narration || undefined,
            reference: values.reference || undefined,
            debitEntries: legsToInput(values.debits),
            creditEntries: legsToInput(values.credits),
          };
          const res =
            formMode === 'edit' && editingId
              ? await updateSabcrmJournalEntryFull(editingId, payload)
              : await createSabcrmJournalEntryFull({
                  ...payload,
                  status: post ? 'posted' : 'draft',
                });
          if (!res.ok) return res;
          toast.success(
            formMode === 'edit'
              ? `${res.data.voucherNumber} updated.`
              : post
                ? `${res.data.voucherNumber} posted.`
                : `${res.data.voucherNumber} saved as draft.`,
          );
          refresh();
          return { ok: true };
        }}
      />

      <Dialog open={viewOpen} onOpenChange={(next) => !next && closeView()}>
        <DialogContent
          aria-describedby="journal-entry-view-desc"
          className="max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>
              {detail ? detail.voucherNumber : 'Journal entry'}
            </DialogTitle>
            <DialogDescription id="journal-entry-view-desc">
              {detail
                ? `${detail.bookLabel ?? 'Unknown book'} · ${formatDocDate(detail.date)}`
                : 'Loading the entry…'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-10">
              <Spinner aria-label="Loading journal entry" />
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-1">
              <StatusFlow
                flow={JOURNAL_ENTRY_FLOW}
                statuses={JOURNAL_ENTRY_STATUSES}
                current={detail.status}
              />

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="opacity-60">Book:</span>{' '}
                  {detail.bookLabel ?? 'Unknown book'}
                </span>
                <span>
                  <span className="opacity-60">Date:</span>{' '}
                  {formatDocDate(detail.date)}
                </span>
                {detail.reference ? (
                  <span>
                    <span className="opacity-60">Reference:</span>{' '}
                    {detail.reference}
                  </span>
                ) : null}
                {detail.createdAt ? (
                  <span>
                    <span className="opacity-60">Created:</span>{' '}
                    {formatDocDate(detail.createdAt)}
                  </span>
                ) : null}
              </div>

              <LegTable caption="Debits" legs={detail.debits} />
              <LegTable caption="Credits" legs={detail.credits} />

              <div className="flex items-center justify-end gap-4 text-sm">
                <Badge
                  tone={
                    Math.abs(detail.totalDebit - detail.totalCredit) < 0.01
                      ? 'success'
                      : 'warning'
                  }
                  dot
                >
                  {Math.abs(detail.totalDebit - detail.totalCredit) < 0.01
                    ? 'Balanced'
                    : 'Unbalanced'}
                </Badge>
                <span>
                  <span className="opacity-60">Debit:</span>{' '}
                  {formatDocMoney(detail.totalDebit, 'INR')}
                </span>
                <span>
                  <span className="opacity-60">Credit:</span>{' '}
                  {formatDocMoney(detail.totalCredit, 'INR')}
                </span>
              </div>

              {detail.narration ? (
                <p className="text-sm opacity-80">{detail.narration}</p>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {detail && detail.status !== 'archived' ? (
              <Button
                variant="ghost"
                iconLeft={Archive}
                disabled={actionBusy || detailLoading}
                onClick={() => detail && void archiveEntry(detail.id)}
              >
                Archive
              </Button>
            ) : null}
            {detail?.status === 'draft' ? (
              <>
                <Button
                  variant="secondary"
                  iconLeft={FileEdit}
                  disabled={actionBusy || detailLoading}
                  onClick={() => detail && openEdit(detail)}
                >
                  Edit
                </Button>
                <Button
                  variant="primary"
                  iconLeft={CheckCircle2}
                  loading={actionBusy}
                  onClick={() => detail && void postEntry(detail.id)}
                >
                  Post entry
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={closeView}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
