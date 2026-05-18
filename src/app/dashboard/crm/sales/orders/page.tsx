import { ZoruButton } from '@/components/zoruui';
import { Plus } from 'lucide-react';

/**
 * CRM Sales Orders list — `/dashboard/crm/sales/orders`.
 *
 * §1D list shell. Server component reads search/filter/page params from
 * the URL, fetches the page-of-rows via the Rust-backed
 * `listSalesOrders` action, computes the 5 KPI counts in parallel, and
 * hands off to `<SalesOrdersListClient>` for KPI clicks / search /
 * filters / bulk-bar / delete dialogs.
 *
 * KPI counts are individual `listSalesOrders({ status, limit: 1 })`
 * calls — the Rust handler returns `hasMore`-style arrays without a
 * total field, so we approximate. Anything more accurate needs a
 * dedicated `/sales-orders/counts` endpoint (see CRM_REBUILD_PLAN.md
 * Phase 2).
 *
 * Pagination is hasMore-driven — see `<PaginationBar>`.
 */

import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listSalesOrders } from '@/app/actions/crm/sales-orders.actions';
import { crmSalesOrdersApi } from '@/lib/rust-client/crm-sales-orders';
import { SalesOrdersListClient } from './_components/sales-orders-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  clientId?: string;
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
  shipFrom?: string;
  shipTo?: string;
}

/** Coarse KPI counts. Server fetches each status bucket with limit=1k
 * (Rust list endpoint caps at 100, so this is "at most 100" per
 * bucket). When a real `/counts` endpoint lands we swap this. */
async function fetchKpis(): Promise<{
  open: number;
  partial: number;
  fulfilled: number;
  closed: number;
  cancelled: number;
}> {
  const fetchBucket = async (status: string): Promise<number> => {
    try {
      const rows = await crmSalesOrdersApi.list({ status, page: 1, limit: 100 });
      // If we hit the page cap, signal "100+" by returning 100.
      return rows.length;
    } catch {
      return 0;
    }
  };
  const [open, partial, fulfilled, closed, cancelled] = await Promise.all([
    fetchBucket('open'),
    fetchBucket('partial'),
    fetchBucket('fulfilled'),
    fetchBucket('closed'),
    fetchBucket('cancelled'),
  ]);
  return { open, partial, fulfilled, closed, cancelled };
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
  const status = (sp.status ?? '').trim();
  const clientId = (sp.clientId ?? '').trim();
  const agentId = (sp.agentId ?? '').trim();
  const dateFrom = (sp.dateFrom ?? '').trim();
  const dateTo = (sp.dateTo ?? '').trim();
  const shipFrom = (sp.shipFrom ?? '').trim();
  const shipTo = (sp.shipTo ?? '').trim();

  const [listResult, kpis] = await Promise.all([
    listSalesOrders({
      page,
      limit,
      q: q || undefined,
      status: status || undefined,
      clientId: clientId || undefined,
    }),
    fetchKpis(),
  ]);

  // Client-side filter for the dimensions the Rust list endpoint
  // doesn't support yet (agent / date / expected-shipment). Inexpensive
  // since we're only filtering one page-of-rows.
  const filtered = listResult.orders.filter((o) => {
    if (agentId && o.assignment?.assignedTo !== agentId) return false;
    if (dateFrom && (!o.date || o.date < dateFrom)) return false;
    if (dateTo && (!o.date || o.date > `${dateTo}T23:59:59Z`)) return false;
    if (shipFrom && (!o.expectedShipmentDate || o.expectedShipmentDate < shipFrom)) return false;
    if (shipTo && (!o.expectedShipmentDate || o.expectedShipmentDate > `${shipTo}T23:59:59Z`)) return false;
    return true;
  });

  return (
    <EntityListShell
      title="Sales Orders"
      subtitle="Create, share, and track confirmed customer orders."
      primaryAction={
        <ZoruButton asChild>
          <Link href="/dashboard/crm/sales/orders/new">
            <Plus className="h-4 w-4" />
            New sales order
          </Link>
        </ZoruButton>
      }
    >
      <SalesOrdersListClient
        orders={filtered}
        page={listResult.page}
        limit={listResult.limit}
        hasMore={listResult.hasMore}
        initialQuery={q}
        initialStatus={status}
        initialClientId={clientId}
        initialAgentId={agentId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialShipFrom={shipFrom}
        initialShipTo={shipTo}
        kpis={kpis}
        error={listResult.error}
      />
    </EntityListShell>
  );
}
