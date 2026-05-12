/**
 * CRM Invoices list — `/dashboard/crm/sales/invoices`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listInvoices` action, and hands off to
 * `<InvoiceListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { Receipt, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listInvoices } from '@/app/actions/crm/invoices.actions';
import { InvoiceListClient } from './_components/invoice-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { invoices, hasMore, error } = await listInvoices({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Invoices"
        subtitle="Bill customers and track payment state across your sales pipeline."
        icon={Receipt}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/invoices/new">
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
          </ZoruButton>
        }
      />

      <InvoiceListClient
        invoices={invoices}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
