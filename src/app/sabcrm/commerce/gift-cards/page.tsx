/**
 * SabCRM Commerce — Gift cards (`/sabcrm/commerce/gift-cards`), 20ui.
 *
 * Server entry: lists the active project's gift cards through the gated
 * `listSabcrmGiftCards` action (crate `crm-gift-cards`,
 * `/v1/sabcrm/commerce/gift-cards`) and renders via the shared
 * {@link CommerceClient}.
 */

import * as React from 'react';

import { listSabcrmGiftCards } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Gift cards — SabCRM Commerce',
};

export default async function SabcrmCommerceGiftCardsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmGiftCards({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.code,
    status: doc.status ?? 'active',
    currency: 'INR',
    cells: {
      code: doc.code,
      value: doc.value,
      balance: doc.balance,
      issuedTo: doc.issuedTo ?? undefined,
      expiryDate: doc.expiryDate ?? undefined,
    },
  }));

  return (
    <CommerceClient
      kind="gift-cards"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
