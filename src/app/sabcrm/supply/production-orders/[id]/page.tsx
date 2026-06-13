/**
 * SabCRM Supply — Production order detail
 * (`/sabcrm/supply/production-orders/[id]`, rollout WI-11).
 */

import * as React from 'react';

import {
  getSabcrmSupplyProductionOrder,
  getSabcrmSupplyBom,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { ProductionOrderDetailClient } from './production-order-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Production order — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyProductionOrderDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const res = await getSabcrmSupplyProductionOrder(id);
  if (!res.ok) {
    return (
      <ProductionOrderDetailClient
        order={null}
        bomLabel={null}
        error={res.error}
      />
    );
  }
  const order = res.data;
  let bomLabel: string | null = null;
  if (order.bomId) {
    const bomRes = await getSabcrmSupplyBom(order.bomId);
    bomLabel = bomRes.ok
      ? `${bomRes.data.bomNo} — ${bomRes.data.finishedGoodName}`
      : (order.bomRef ?? null);
  } else if (order.bomRef) {
    bomLabel = order.bomRef;
  }

  return (
    <ProductionOrderDetailClient
      order={order}
      bomLabel={bomLabel}
      error={null}
    />
  );
}
