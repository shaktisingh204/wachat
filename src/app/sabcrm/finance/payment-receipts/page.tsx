/**
 * SabCRM Finance — Payment receipts (`/sabcrm/finance/payment-receipts`),
 * 20ui.
 *
 * Server entry: lists the active project's payment receipts through the
 * gated `listSabcrmPaymentReceipts` action (session → project → RBAC →
 * plan gate, then `/v1/sabcrm/finance/payment-receipts`). Renders via the
 * shared {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmPaymentReceipts } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment receipts — SabCRM Finance',
};

export default async function SabcrmFinancePaymentReceiptsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPaymentReceipts();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.receiptNo,
        party: doc.clientId ?? '',
        date: doc.date,
        amount: doc.amount ?? 0,
        currency: doc.currency,
        status: doc.status ?? 'received',
      }))
    : [];

  return (
    <FinanceDocClient
      kind="payment-receipts"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
