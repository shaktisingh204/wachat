/**
 * SabCRM Commerce — POS transaction detail
 * (`/sabcrm/commerce/pos-transactions/[transactionId]`), 20ui.
 *
 * Server entry: fetches one transaction, its refunds, and resolved
 * customer + session labels in parallel through the gated actions,
 * then renders the DocDetailPage-based
 * {@link PosTransactionDetailClient} with Void + line-pick Refund
 * dialogs and a refunds rail.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import {
  getSabcrmPosTransaction,
  listSabcrmPosTransactionRefunds,
  getSabcrmPosSession,
} from '@/app/actions/sabcrm-commerce-docs.actions';
import { resolveSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import { PosTransactionDetailClient } from './pos-transaction-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS transaction — SabCRM Commerce',
};

interface PageProps {
  params: Promise<{ transactionId: string }>;
}

export default async function SabcrmCommercePosTransactionDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { transactionId } = await params;

  const txnRes = await getSabcrmPosTransaction(transactionId);
  if (!txnRes.ok) {
    notFound();
  }
  const txn = txnRes.data;

  const [refundsRes, sessionRes, customerRes] = await Promise.all([
    listSabcrmPosTransactionRefunds(transactionId),
    getSabcrmPosSession(txn.sessionId),
    txn.customerId
      ? resolveSabcrmFinanceParties([txn.customerId])
      : Promise.resolve({ ok: true as const, data: [] }),
  ]);

  const sessionLabel = sessionRes.ok
    ? [sessionRes.data.terminalId, sessionRes.data.openedAt.slice(0, 10)]
        .filter(Boolean)
        .join(' · ')
    : null;
  const customerLabel =
    txn.customerId && customerRes.ok
      ? (customerRes.data[0]?.label ?? 'Customer')
      : null;

  return (
    <PosTransactionDetailClient
      transaction={txn}
      refunds={refundsRes.ok ? refundsRes.data : []}
      sessionLabel={sessionLabel}
      customerLabel={customerLabel}
    />
  );
}
