/**
 * SabCRM Finance — Payouts (`/sabcrm/finance/payouts`), 20ui.
 *
 * Server entry: lists the active project's vendor payouts through the
 * gated `listSabcrmPayouts` action (crate `crm-payouts`,
 * `/v1/sabcrm/finance/payouts`). NB: payout-style wire — bare-array
 * list, HARD delete. Renders via the shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmPayouts } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payouts — SabCRM Finance',
};

export default async function SabcrmFinancePayoutsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPayouts();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.paymentNo,
        party: doc.vendorId,
        date: doc.date,
        amount: doc.amount,
        currency: doc.currency || 'INR',
        status: doc.status ?? 'sent',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="payouts"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
