/**
 * SabCRM Supply — GRN detail (`/sabcrm/supply/grn/[id]`, rollout WI-6).
 *
 * Server entry: fetches the GRN, its vendor / warehouse / PO / inspector
 * labels, and the resolved quartet lines (item labels) in parallel, then
 * hands everything to the detail client.
 */

import * as React from 'react';

import {
  getSabcrmSupplyGrn,
  getSabcrmSupplyVendor,
  getSabcrmSupplyWarehouse,
  getSabcrmSupplyPurchaseOrder,
} from '@/app/actions/sabcrm-supply-docs.actions';
import { getSabcrmSupplyGrnDetailLines } from '@/app/actions/sabcrm-supply-grn.actions';
import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import { GrnDetailClient } from './grn-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Goods receipt — SabCRM Supply',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmSupplyGrnDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const grnRes = await getSabcrmSupplyGrn(id);
  if (!grnRes.ok) {
    return (
      <GrnDetailClient
        grn={null}
        vendorLabel={null}
        warehouseLabel={null}
        poLabel={null}
        inspectorLabel={null}
        detailLines={[]}
        error={grnRes.error}
      />
    );
  }

  const grn = grnRes.data;
  const [vendorRes, warehouseRes, poRes, inspectorRes, linesRes] =
    await Promise.all([
      grn.vendorId
        ? getSabcrmSupplyVendor(grn.vendorId)
        : Promise.resolve({ ok: false as const, error: 'No vendor.' }),
      grn.warehouseId
        ? getSabcrmSupplyWarehouse(grn.warehouseId)
        : Promise.resolve({ ok: false as const, error: 'No warehouse.' }),
      grn.poId
        ? getSabcrmSupplyPurchaseOrder(grn.poId)
        : Promise.resolve({ ok: false as const, error: 'No PO.' }),
      grn.inspectorId
        ? getSabcrmFinancePartyContact(grn.inspectorId)
        : Promise.resolve({ ok: false as const, error: 'No inspector.' }),
      getSabcrmSupplyGrnDetailLines(id),
    ]);

  return (
    <GrnDetailClient
      grn={grn}
      vendorLabel={
        vendorRes.ok
          ? vendorRes.data.displayName || vendorRes.data.name || null
          : null
      }
      warehouseLabel={warehouseRes.ok ? warehouseRes.data.name || null : null}
      poLabel={poRes.ok ? poRes.data.poNo || null : null}
      inspectorLabel={
        inspectorRes.ok && inspectorRes.data ? inspectorRes.data.label : null
      }
      detailLines={linesRes.ok ? linesRes.data : []}
      error={null}
    />
  );
}
