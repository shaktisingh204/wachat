/**
 * CRM Debit Notes list — `/dashboard/crm/purchases/debit-notes`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listDebitNotes` action, and hands off
 * to `<DebitNoteListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { FileMinus, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listDebitNotes } from '@/app/actions/crm/debit-notes.actions';
import { DebitNoteListClient } from './_components/debit-note-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function DebitNotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { debitNotes, hasMore, error } = await listDebitNotes({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Debit Notes"
        subtitle="Adjust vendor bills downward for returns, discounts, or short-shipment."
        icon={FileMinus}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/debit-notes/new">
              <Plus className="h-4 w-4" />
              New debit note
            </Link>
          </ZoruButton>
        }
      />

      <DebitNoteListClient
        debitNotes={debitNotes}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
