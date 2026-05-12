/**
 * CRM Sales Orders list — `/dashboard/crm/sales/orders`.
 *
 * Server component shell. Reads search/page/limit from the URL,
 * fetches via the Rust-backed `listSalesOrders` action, and hands off
 * to `<SalesOrderListClient>` for interactive bits (search, delete
 * dialog).
 *
 * Pagination is hasMore-driven (the Rust endpoint doesn't return a
 * total count) — see `<PaginationBar>`.
 */

import Link from 'next/link';
import { ShoppingCart, Plus } from 'lucide-react';

import { ZoruButton } from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';
import { listSalesOrders } from '@/app/actions/crm/sales-orders.actions';
import { SalesOrderListClient } from './_components/sales-order-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const limit = Math.min(Math.max(1, Number(sp.limit) || 20), 100);
  const q = (sp.q ?? '').trim();

  const { orders, hasMore, error } = await listSalesOrders({
    page,
    limit,
    q: q || undefined,
  });

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Sales Orders"
        subtitle="Create, share, and track confirmed customer orders."
        icon={ShoppingCart}
        actions={
          <ZoruButton asChild>
            <Link href="/dashboard/crm/sales/orders/new">
              <Plus className="h-4 w-4" />
              New sales order
            </Link>
          </ZoruButton>
        }
      />

      <SalesOrderListClient
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
