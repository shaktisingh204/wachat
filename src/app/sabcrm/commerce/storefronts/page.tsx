/**
 * SabCRM Commerce — Storefronts (`/sabcrm/commerce/storefronts`), 20ui.
 *
 * Server entry: lists the active project's storefronts through the
 * gated `listSabcrmStorefronts` action (crate `crm-store`,
 * `/v1/sabcrm/commerce/store/storefronts`) and renders via the shared
 * {@link CommerceClient}.
 */

import * as React from 'react';

import { listSabcrmStorefronts } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Storefronts — SabCRM Commerce',
};

export default async function SabcrmCommerceStorefrontsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmStorefronts({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.name,
    status: doc.status,
    currency: doc.currency || 'INR',
    cells: {
      name: doc.name,
      slug: doc.slug,
      domain: doc.domain ?? undefined,
      currency: doc.currency,
    },
  }));

  return (
    <CommerceClient
      kind="storefronts"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
