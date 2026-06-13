/**
 * SabCRM Supply — Production orders (`/sabcrm/supply/production-orders`,
 * rollout WI-11).
 *
 * Server entry: page 1 of list rows + the KPI strip in parallel.
 * `?fromBom=<id>` (the BOM detail's "Start production" convert) is
 * resolved into a prefilled form seed so the run starts from the recipe.
 */

import * as React from 'react';

import {
  getSabcrmSupplyProductionOrderBomPrefill,
  getSabcrmSupplyProductionOrderKpis,
  listSabcrmSupplyProductionOrdersPage,
} from '@/app/actions/sabcrm-supply-production-orders.actions';
import { suggestNextSupplyNumber } from '@/app/actions/sabcrm-supply-docs.actions';
import type { SabcrmProductionOrderStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { ProductionOrdersClient } from './production-orders-client';
import { blankBomComponent } from '../bom/bom-components-editor';
import type { ProductionOrderFormState } from './production-order-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Production orders — SabCRM Supply',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmSupplyProductionOrdersPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as SabcrmProductionOrderStatus | '';
  const from = first(params.from);
  const to = first(params.to);
  const fromBom = first(params.fromBom);

  const [pageRes, kpiRes] = await Promise.all([
    listSabcrmSupplyProductionOrdersPage({
      page: 1,
      q: q || undefined,
      status,
      from,
      to,
    }),
    getSabcrmSupplyProductionOrderKpis(),
  ]);

  let prefillState: ProductionOrderFormState | null = null;
  if (fromBom) {
    const [prefillRes, numberRes] = await Promise.all([
      getSabcrmSupplyProductionOrderBomPrefill(fromBom),
      suggestNextSupplyNumber('production-order'),
    ]);
    if (prefillRes.ok) {
      const p = prefillRes.data;
      prefillState = {
        orderNo: numberRes.ok ? numberRes.data : '',
        bomId: p.bomId,
        bomLabel: p.bomRef,
        bomRef: p.bomRef,
        finishedGoodId: p.finishedGoodId,
        finishedGoodLabel: p.finishedGoodId ? p.finishedGoodName : null,
        finishedGoodName: p.finishedGoodName,
        plannedQty: String(p.outputQty || 1),
        unit: p.unit,
        plannedStart: '',
        plannedEnd: '',
        machineId: '',
        machineOperatorId: null,
        machineOperatorLabel: null,
        machineOperator: '',
        labourCost: p.labourCost === undefined ? '' : String(p.labourCost),
        overheadCost:
          p.overheadCost === undefined ? '' : String(p.overheadCost),
        notes: '',
        components:
          p.components.length > 0
            ? p.components.map((c, i) => ({
                rowId: `bom-${i}`,
                itemId: c.itemId,
                itemName: c.itemName,
                qty: c.qty,
                unit: c.unit,
                scrapPct: c.scrapPct,
                costPerUnit: c.costPerUnit,
              }))
            : [blankBomComponent()],
      };
    }
  }

  return (
    <ProductionOrdersClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || from || to ? { q, status, from, to } : undefined
      }
      prefillState={prefillState}
    />
  );
}
