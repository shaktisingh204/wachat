/**
 * SabCRM Commerce — Shipping zones (`/sabcrm/commerce/shipping`), 20ui.
 *
 * Server entry: lists the active project's shipping zones through the
 * gated `listSabcrmShippingZones` action (crate `crm-store`,
 * `/v1/sabcrm/commerce/store/shipping-zones`). The "New shipping zone"
 * dialog needs the project's storefronts for its select, so both lists
 * are fetched in parallel.
 */

import * as React from 'react';

import {
  listSabcrmShippingZones,
  listSabcrmStorefronts,
} from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Shipping zones — SabCRM Commerce',
};

export default async function SabcrmCommerceShippingPage(): Promise<React.JSX.Element> {
  const [zonesRes, storefrontsRes] = await Promise.all([
    listSabcrmShippingZones({ limit: 100 }),
    listSabcrmStorefronts({ limit: 100 }),
  ]);
  const docs = zonesRes.ok ? zonesRes.data : [];
  const storefronts = storefrontsRes.ok ? storefrontsRes.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.name,
    status: doc.status,
    currency: 'INR',
    cells: {
      name: doc.name,
      countries: (doc.countries ?? []).join(', '),
      methods: doc.methods?.length ?? 0,
    },
  }));

  return (
    <CommerceClient
      kind="shipping"
      initialRows={rows}
      initialError={zonesRes.ok ? null : zonesRes.error}
      selectOptions={{
        storefronts: storefronts.map((s) => ({
          value: s._id,
          label: s.name,
        })),
      }}
    />
  );
}
