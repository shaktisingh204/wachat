/**
 * Proforma Invoices list — `/dashboard/crm/sales/proforma`
 * §1D rebuild. Server component. Reads page/limit/q/status from the URL,
 * fetches a page window + KPI counts in parallel, and hands data to
 * `<ProformaListClient>` which composes `<EntityListShell>` internally.
 */

import {
  listProformaInvoices,
  getProformaInvoiceKpis,
} from '@/app/actions/crm-proforma-invoices.actions';
import { ProformaListClient } from './_components/proforma-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ProformaInvoicesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const dateFrom = (sp.dateFrom ?? '').trim();
  const dateTo = (sp.dateTo ?? '').trim();

  const [{ items, hasMore }, kpi] = await Promise.all([
    listProformaInvoices({
      page,
      limit,
      q: q || undefined,
      status: (status as 'all') || undefined,
    }),
    getProformaInvoiceKpis(),
  ]);

  return (
    <ProformaListClient
      invoices={items}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      initialStatus={status}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      kpi={kpi}
    />
  );
}
