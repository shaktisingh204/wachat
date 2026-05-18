/**
 * Recurring Invoices list — `/dashboard/crm/sales/recurring-invoices`
 * §1D rebuild. Server component. Reads page/limit/q/status from the URL,
 * fetches a page window, and hands data to `<RecurringInvoiceListClient>`
 * which composes `<EntityListShell>` internally.
 */

import { getRecurringInvoices } from '@/app/actions/crm-recurring-invoices.actions';
import { RecurringInvoiceListClient } from './_components/recurring-invoice-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function RecurringInvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();

  const { items, hasMore } = await getRecurringInvoices({
    q: q || undefined,
    status: (status as any) || undefined,
    limit,
  });

  return (
    <RecurringInvoiceListClient
      invoices={items}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      initialStatus={status}
    />
  );
}
