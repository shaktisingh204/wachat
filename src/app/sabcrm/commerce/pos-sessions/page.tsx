/**
 * SabCRM Commerce — POS sessions (`/sabcrm/commerce/pos-sessions`), 20ui.
 *
 * Server entry: lists the active project's register sessions through the
 * gated `listSabcrmPosSessions` action (crate `crm-pos`,
 * `/v1/sabcrm/commerce/pos/sessions`) and renders via the shared
 * {@link CommerceClient}.
 */

import * as React from 'react';

import { listSabcrmPosSessions } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS sessions — SabCRM Commerce',
};

export default async function SabcrmCommercePosSessionsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPosSessions({ limit: 100, status: 'all' });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.terminalId,
    status: doc.status,
    currency: 'INR',
    cells: {
      terminalId: doc.terminalId,
      openedAt: doc.openedAt,
      openingCash: doc.openingCash,
      closingCash: doc.closingCash ?? undefined,
      discrepancy: doc.discrepancy ?? undefined,
    },
  }));

  return (
    <CommerceClient
      kind="pos-sessions"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
