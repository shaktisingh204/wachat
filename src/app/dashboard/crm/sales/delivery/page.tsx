/**
 * Delivery Challans list — `/dashboard/crm/sales/delivery`
 * §1D rebuild. Server component reads search/filter params from the URL,
 * hydrates a page of challans + KPI bucket counts via `getDeliveryChallans`,
 * and hands off to `<DeliveryListClient>` which composes EntityListShell.
 */

import {
  getDeliveryChallanKpis,
  getDeliveryChallans,
} from '@/app/actions/crm-delivery-challans.actions';
import {
  DeliveryListClient,
  type DcStatus,
} from './_components/delivery-list-client';
import type { LineageRef } from '@/lib/definitions';

export const dynamic = 'force-dynamic';

interface SearchParams {
  page?: string;
  limit?: string;
  q?: string;
  status?: string;
  clientId?: string;
  transporterId?: string;
  dateFrom?: string;
  dateTo?: string;
  warehouseId?: string;
}

export default async function DeliveryChallansPage({
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
  const transporterId = (sp.transporterId ?? '').trim();
  const dateFrom = (sp.dateFrom ?? '').trim();
  const dateTo = (sp.dateTo ?? '').trim();
  const warehouseId = (sp.warehouseId ?? '').trim();

  // Fetch a wider window for client-side filter + KPI bucketing. The
  // Mongo action returns up to `limit` rows, so we ask for the largest
  // sensible page (200) and slice down. This is a temporary
  // approximation — a Rust crate + dedicated /counts endpoint is the
  // future state (see CRM_REBUILD_PLAN.md Phase 2 W4).
  const [wide, kpiSnapshot] = await Promise.all([
    getDeliveryChallans(1, 200, q || undefined),
    getDeliveryChallanKpis(),
  ]);
  const all = wide.challans;

  // KPI counts. Headline numbers (`totalChallans` + `deliveredToday`)
  // come from a dedicated tenant-scoped aggregate so we don't undercount
  // when the loaded window is < total. The window-derived buckets are
  // kept as a useful "in this view" hint.
  const kpis = {
    draft: all.filter((c) => c.status === 'Draft').length,
    inTransit: kpiSnapshot.inTransit,
    delivered: all.filter((c) => c.status === 'Delivered').length,
    returned: kpiSnapshot.returned,
    totalChallans: kpiSnapshot.totalChallans,
    deliveredToday: kpiSnapshot.deliveredToday,
  };

  // Server-side filter (Mongo action doesn't yet expose these filters).
  const filtered = all.filter((c) => {
    if (status && c.status !== status) return false;
    if (clientId && String(c.accountId) !== clientId) return false;
    if (dateFrom) {
      const d = new Date(c.challanDate);
      if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(c.challanDate);
      if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) > dateTo) return false;
    }
    return true;
  });

  // Pagination over the filtered set.
  const skip = (page - 1) * limit;
  const pageSlice = filtered.slice(skip, skip + limit);
  const hasMore = filtered.length > skip + limit;

  // Project rows to the lean shape the client expects.
  const rows = pageSlice.map((c) => {
    const soRef = ((c.lineage ?? []) as LineageRef[]).find((l) => l.kind === 'salesOrder')?.id;
    const lineItems = (c.lineItems || []) as any[];
    const batchCount = lineItems.filter((it) => it.batch).length;
    const serialsCount = lineItems.reduce((acc, it) => {
      const cnt = Array.isArray(it.serialNumbers) ? it.serialNumbers.length : 0;
      return acc + cnt;
    }, 0);
    return {
      _id: String(c._id),
      challanNumber: c.challanNumber || '',
      accountId: String(c.accountId),
      challanDate: new Date(c.challanDate).toISOString(),
      status: (c.status as DcStatus) ?? 'Draft',
      reason: c.reason,
      vehicleNumber: c.transportDetails?.vehicleNumber,
      driverName: c.transportDetails?.driverName,
      mode: c.transportDetails?.mode,
      warehouseId: undefined,
      transporterId: undefined,
      soRef,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
      batchCount,
      serialsCount,
    };
  });

  return (
    <DeliveryListClient
      rows={rows}
      page={page}
      limit={limit}
      hasMore={hasMore}
      initialQuery={q}
      initialStatus={status}
      initialClientId={clientId}
      initialTransporterId={transporterId}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      initialWarehouseId={warehouseId}
      kpis={kpis}
    />
  );
}
