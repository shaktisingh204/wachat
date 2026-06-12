/**
 * SabCRM Commerce — POS holds (`/sabcrm/commerce/pos-holds`), 20ui.
 *
 * Server entry: lists the active project's parked register tickets
 * through the gated `listSabcrmPosHolds` action (crate `crm-pos`,
 * `/v1/sabcrm/commerce/pos/holds`). Read-heavy — holds are parked and
 * recalled at the register; voiding is the only action here.
 */

import * as React from 'react';

import { listSabcrmPosHolds } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS holds — SabCRM Commerce',
};

export default async function SabcrmCommercePosHoldsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPosHolds({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.holdReason || `hold from ${doc.heldAt.slice(0, 10)}`,
    status: doc.status,
    currency: 'INR',
    cells: {
      heldAt: doc.heldAt,
      holdReason: doc.holdReason ?? undefined,
      lines: doc.lineItems?.length ?? 0,
    },
  }));

  return (
    <CommerceClient
      kind="pos-holds"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
