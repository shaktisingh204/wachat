/**
 * SabCRM Supply — Vendors (`/sabcrm/supply/vendors`), 20ui.
 *
 * Server entry: lists the active project's vendors through the gated
 * `listSabcrmSupplyVendors` action (crate `crm-vendors`,
 * `/v1/sabcrm/supply/vendors`) and renders via the shared
 * {@link SupplyClient}. Vendors stay a bespoke crate (NOT a metadata
 * object) — this page is their full CRUD surface.
 */

import * as React from 'react';

import { listSabcrmSupplyVendors } from '@/app/actions/sabcrm-supply.actions';
import { SupplyClient, type SupplyRow } from '../_components/supply-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendors — SabCRM Supply',
};

export default async function SabcrmSupplyVendorsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmSupplyVendors({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: SupplyRow[] = docs.map((doc) => ({
    id: doc._id ?? '',
    label: doc.name,
    status: 'active',
    currency: 'INR',
    cells: {
      name: doc.name,
      email: doc.email ?? '',
      phone: doc.phone ?? '',
      gstin: doc.gstin ?? '',
      vendorType: doc.vendorType ?? '',
    },
  }));

  return (
    <SupplyClient
      kind="vendors"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
