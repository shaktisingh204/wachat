/**
 * SabCRM Finance — Bank transactions
 * (`/sabcrm/finance/bank-transactions`), 20ui.
 *
 * Server entry: lists the active project's bank transactions through the
 * gated `listSabcrmBankTransactions` action (session → project → RBAC →
 * plan gate, then `/v1/sabcrm/finance/bank-transactions`). Renders via
 * the shared {@link FinanceLedgerClient} — debit rows tint red, credit
 * rows tint green.
 */

import * as React from 'react';

import { listSabcrmBankTransactions } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Bank transactions — SabCRM Finance',
};

/** Shorten a 24-char hex ref for display (`…a1b2c3d4`). */
function shortRef(id: string | undefined): string {
  return id ? `…${id.slice(-8)}` : '—';
}

export default async function SabcrmFinanceBankTransactionsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmBankTransactions();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: doc.referenceNumber || doc.description || shortRef(doc._id),
        status: doc.status,
        currency: 'INR',
        cells: {
          date: doc.transactionDate,
          account: shortRef(doc.accountId),
          description: doc.description ?? '',
          reference: doc.referenceNumber ?? '',
          amount: doc.amount,
          type: doc.type,
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="bank-transactions"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
