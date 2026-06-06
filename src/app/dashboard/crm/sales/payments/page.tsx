import { Button } from '@/components/sabcrm/20ui/compat';
import { Plus } from 'lucide-react';

/**
 * CRM Payment Receipts list — `/dashboard/crm/sales/payments`.
 *
 * §1D list shell. Server component reads search/page/limit/status/
 * method/date params from the URL, fetches via the Rust-backed
 * `listPaymentReceipts` action plus a `getPaymentReceiptKpis` snapshot,
 * and hands off to `<PaymentReceiptListClient>` for KPI strip, filter
 * row, bulk-bar, and CSV/XLSX export.
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getPaymentReceiptKpis,
  listPaymentReceipts,
} from '@/app/actions/crm/payment-receipts.actions';
import type { CrmReceiptStatus } from '@/lib/rust-client/crm-payment-receipts';
import { PaymentReceiptListClient } from './_components/payment-receipt-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  clientId?: string;
  mode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export default async function PaymentReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const clientId = (sp.clientId ?? '').trim();
  const mode = (sp.mode ?? '').trim();
  const dateFrom = (sp.dateFrom ?? '').trim();
  const dateTo = (sp.dateTo ?? '').trim();

  const [listResult, kpis] = await Promise.all([
    listPaymentReceipts({
      page,
      limit,
      q: q || undefined,
      clientId: clientId || undefined,
      status: status ? (status as CrmReceiptStatus) : undefined,
    }),
    getPaymentReceiptKpis(),
  ]);

  // Client-side filter for the dimensions the Rust list endpoint
  // doesn't expose yet (mode / date range).
  const filtered = listResult.receipts.filter((r) => {
    if (mode && (r.mode ?? '').toLowerCase() !== mode.toLowerCase()) return false;
    if (dateFrom && (!r.date || r.date < dateFrom)) return false;
    if (dateTo && (!r.date || r.date > `${dateTo}T23:59:59Z`)) return false;
    return true;
  });

  return (
    <EntityListShell
      title="Payment Receipts"
      subtitle="Record incoming customer payments and reconcile them against invoices."
      primaryAction={
        <Button asChild>
          <Link href="/dashboard/crm/sales/payments/new">
            <Plus className="h-4 w-4" />
            New receipt
          </Link>
        </Button>
      }
    >
      <PaymentReceiptListClient
        receipts={filtered}
        page={page}
        limit={limit}
        hasMore={listResult.hasMore}
        initialQuery={q}
        initialStatus={status}
        initialClientId={clientId}
        initialMode={mode}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        kpis={kpis}
        error={listResult.error}
      />
    </EntityListShell>
  );
}
