/**
 * SabCRM Supply — Bills of material (`/sabcrm/supply/bom`), 20ui.
 *
 * Server entry: lists the active project's BOMs through the gated
 * `listSabcrmSupplyBoms` action (crate `crm-bom`,
 * `/v1/sabcrm/supply/bom`) and renders via the shared
 * {@link SupplyClient}.
 */

import * as React from 'react';

import { listSabcrmSupplyBoms } from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bills of material — SabCRM Supply',
};

export default async function SabcrmSupplyBomPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSupplyBoms({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.bomNo,
    status: doc.status ?? 'draft',
    currency: 'INR',
    cells: {
      bomNo: doc.bomNo,
      finishedGoodName: doc.finishedGoodName,
      outputQty: doc.outputQty,
      unit: doc.unit,
      version: doc.version,
    },
  }));

  return (
    <SupplyClient
      kind="bom"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
