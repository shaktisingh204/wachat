/**
 * Delivery Challans list — `/dashboard/crm/sales/delivery`
 * §1D rebuild. Server component reads search/filter params from the URL,
 * hydrates a page of challans + KPI bucket counts via `getDeliveryChallans`,
 * and hands off to `<DeliveryListClient>` which composes EntityListShell.
 */

import { Suspense } from 'react';
import {
  getDeliveryChallanKpis,
  getDeliveryChallans,
} from '@/app/actions/crm-delivery-challans.actions';
import {
  DeliveryListClient,
  type DcStatus,
} from './_components/delivery-list-client';
import type { LineageRef } from '@/lib/definitions';
import { Skeleton } from '@/components/sabcrm/20ui';

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

  // The Mongo action now accepts filters and limit/offset directly.
  const [wide, kpiSnapshot] = await Promise.all([
    getDeliveryChallans(page, limit, q || undefined, {
      status,
      clientId,
      transporterId,
      dateFrom,
      dateTo,
      warehouseId,
    }),
    getDeliveryChallanKpis(),
  ]);
  const pageSlice = wide.challans;
  const total = wide.total;

  const skip = (page - 1) * limit;
  const hasMore = skip + limit < total;

  // KPI counts. Headline numbers (`totalChallans` + `deliveredToday`)
  // come from a dedicated tenant-scoped aggregate so we don't undercount
  // when the loaded window is < total.
  const kpis = {
    draft: kpiSnapshot.draft,
    inTransit: kpiSnapshot.inTransit,
    delivered: kpiSnapshot.delivered,
    returned: kpiSnapshot.returned,
    totalChallans: kpiSnapshot.totalChallans,
    deliveredToday: kpiSnapshot.deliveredToday,
  };

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
    <Suspense fallback={<DeliveryPageLoader />}>
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
    </Suspense>
  );
}

function DeliveryPageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

