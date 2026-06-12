/**
 * SabCRM Commerce — Coupons (`/sabcrm/commerce/coupons`), 20ui.
 *
 * Server entry: lists the active project's coupons through the gated
 * `listSabcrmCoupons` action (crate `crm-coupons`,
 * `/v1/sabcrm/commerce/coupons`) and renders via the shared
 * {@link CommerceClient}.
 */

import * as React from 'react';

import { listSabcrmCoupons } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Coupons — SabCRM Commerce',
};

export default async function SabcrmCommerceCouponsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmCoupons({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.code,
    status: doc.status ?? 'draft',
    currency: 'INR',
    cells: {
      code: doc.code,
      type: doc.type === 'fixed' ? 'Fixed' : 'Percent',
      value: doc.value,
      usedCount: doc.usedCount ?? 0,
      validTo: doc.validTo ?? undefined,
    },
  }));

  return (
    <CommerceClient
      kind="coupons"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
