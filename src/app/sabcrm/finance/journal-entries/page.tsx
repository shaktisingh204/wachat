/**
 * SabCRM Finance — Journal entries (`/sabcrm/finance/journal-entries`).
 *
 * Server entry for the doc-surface-kit adopter (spec §3.14). Parses
 * the `?book=<id>` deep link (the voucher-books surface links each
 * book's entries here) plus `q`/`status` into the initial filters,
 * fetches page 1 of display-ready rows (book labels resolved
 * server-side) and the KPI strip in parallel, then hands everything to
 * the kit-driven client (drawer form with the JournalLinesEditor,
 * `?view=` detail dialog, bulk post/archive, CSV).
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmJournalEntryKpis,
  listSabcrmJournalEntriesPage,
} from '@/app/actions/sabcrm-finance-journal-entries.actions';
import { listSabcrmVoucherBookOptions } from '@/app/actions/sabcrm-finance-pickers.actions';
import { JournalEntriesClient } from './journal-entries-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Journal entries — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<{
    book?: string;
    q?: string;
    status?: string;
  }>;
}

export default async function SabcrmFinanceJournalEntriesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const book = params.book?.trim() || '';
  const q = params.q?.trim() || '';
  const status = params.status?.trim() || '';

  const [pageRes, kpiRes, booksRes] = await Promise.all([
    listSabcrmJournalEntriesPage({
      page: 1,
      q: q || undefined,
      status: (status as '' | 'draft' | 'posted' | 'archived') || '',
      voucherBookId: book || undefined,
    }),
    getSabcrmJournalEntryKpis(),
    book ? listSabcrmVoucherBookOptions() : Promise.resolve(null),
  ]);

  const initialBookLabel =
    book && booksRes?.ok
      ? (booksRes.data.find((b) => b.id === book)?.label ?? null)
      : null;

  return (
    <JournalEntriesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        book || q || status
          ? { q, status, partyId: book }
          : undefined
      }
      initialBookLabel={initialBookLabel}
    />
  );
}
