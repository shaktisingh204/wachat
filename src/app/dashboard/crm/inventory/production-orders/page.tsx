/**
 * Production-Orders list page — server entry loading orders + KPIs and
 * handing off to the §1D client orchestrator.
 */

import { Suspense } from 'react';
import {
  getProductionOrderKpis,
  getProductionOrders,
} from '@/app/actions/crm-production-orders.actions';
import { PoListClient } from './_components/po-list-client';
import ProductionOrdersLoading from './loading';

export const dynamic = 'force-dynamic';

export default async function ProductionOrdersPage() {
  const [orders, kpis] = await Promise.all([
    getProductionOrders(),
    getProductionOrderKpis(),
  ]);
  
  return (
    <Suspense fallback={<ProductionOrdersLoading />}>
      <PoListClient initialOrders={orders} initialKpis={kpis} />
    </Suspense>
  );
}
