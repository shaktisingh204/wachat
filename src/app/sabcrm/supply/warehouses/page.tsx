/**
 * SabCRM Supply — Warehouses (`/sabcrm/supply/warehouses`), 20ui.
 *
 * Server entry: lists the active project's warehouses through the gated
 * `listSabcrmSupplyWarehouses` action (crate `crm-warehouses`,
 * `/v1/sabcrm/supply/warehouses`) and renders via the shared
 * {@link SupplyClient}.
 */

import * as React from 'react';

import { listSabcrmSupplyWarehouses } from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Warehouses — SabCRM Supply',
};

const TYPE_LABEL: Record<string, string> = {
  main: 'Main',
  branch: 'Branch',
  franchise: 'Franchise',
  '3pl': '3PL',
  virtual: 'Virtual',
};

export default async function SabcrmSupplyWarehousesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSupplyWarehouses({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.name,
    status: doc.status ?? 'active',
    currency: 'INR',
    cells: {
      name: doc.name,
      code: doc.code ?? '',
      type: doc.type ? (TYPE_LABEL[doc.type] ?? doc.type) : '—',
      city: doc.city ?? '',
    },
  }));

  return (
    <SupplyClient
      kind="warehouses"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
