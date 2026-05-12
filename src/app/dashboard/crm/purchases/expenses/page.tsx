/**
 * CRM Bills (expenses) list — `/dashboard/crm/purchases/expenses`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listBills` action, and hands off to
 * `<BillListClient>` for interactive bits (search, delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 *
 * NB: the underlying Rust entity is called "bill" — the URL stays at
 * `/purchases/expenses/` for legacy stability.
 */

import Link from 'next/link';
import { Wallet, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listBills } from '@/app/actions/crm/bills.actions';
import { BillListClient } from './_components/bill-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { bills, hasMore, error } = await listBills({ page, limit, q: q || undefined });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Bills & Expenses"
        subtitle="Track vendor invoices, AP ageing, and direct-to-ledger expenses."
        icon={Wallet}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/expenses/new">
              <Plus className="h-4 w-4" />
              New bill
            </Link>
          </ZoruButton>
        }
      />

      <BillListClient
        bills={bills}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
