/**
 * CRM Purchase Orders list — `/dashboard/crm/purchases/orders`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listPurchaseOrders` action, and hands
 * off to `<PurchaseOrderListClient>` for interactive bits (search,
 * delete dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { ShoppingBag, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listPurchaseOrders } from '@/app/actions/crm/purchase-orders.actions';
import { PurchaseOrderListClient } from './_components/purchase-order-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  vendorId?: string;
  status?: string;
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();
  const vendorId = (sp.vendorId ?? '').trim();
  const status = (sp.status ?? '').trim();

  const { orders, hasMore, error } = await listPurchaseOrders({
    page,
    limit,
    q: q || undefined,
    vendorId: vendorId || undefined,
    status: status || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Purchase Orders"
        subtitle="Manage your purchase orders and track vendor deliveries."
        icon={ShoppingBag}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/purchases/orders/new">
              <Plus className="h-4 w-4" />
              New purchase order
            </Link>
          </ZoruButton>
        }
      />

      <PurchaseOrderListClient
        orders={orders}
        page={page}
        limit={limit}
        hasMore={hasMore}
        initialQuery={q}
        error={error}
      />
    </div>
  );
}
