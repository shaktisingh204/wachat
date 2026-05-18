import { ZoruButton } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM Payment Receipts list — `/dashboard/crm/sales/payments`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listPaymentReceipts` action, and hands
 * off to `<PaymentReceiptListClient>` for interactive bits (search,
 * delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listPaymentReceipts } from '@/app/actions/crm/payment-receipts.actions';
import { PaymentReceiptListClient } from './_components/payment-receipt-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
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

  const { receipts, hasMore, error } = await listPaymentReceipts({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <EntityListShell
      title="Payment Receipts"
      subtitle="Record incoming customer payments and reconcile them against invoices."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/sales/payments/new">
            <Plus className="h-4 w-4" />
            New receipt
          </Link>
        </ZoruButton>
      }
    >
      <PaymentReceiptListClient
        receipts={receipts}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </EntityListShell>
  );
}
