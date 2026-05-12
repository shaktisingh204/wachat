/**
 * CRM Credit Notes list — `/dashboard/crm/sales/credit-notes`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listCreditNotes` action, and hands off
 * to `<CreditNoteListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { FileMinus, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listCreditNotes } from '@/app/actions/crm/credit-notes.actions';
import { CreditNoteListClient } from './_components/credit-note-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { creditNotes, hasMore, error } = await listCreditNotes({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Credit Notes"
        subtitle="Issue refunds or credits to customers against prior invoices."
        icon={FileMinus}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/credit-notes/new">
              <Plus className="h-4 w-4" />
              New credit note
            </Link>
          </ZoruButton>
        }
      />

      <CreditNoteListClient
        creditNotes={creditNotes}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
