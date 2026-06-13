/**
 * SabCRM Commerce — POS refund detail
 * (`/sabcrm/commerce/pos-refunds/[refundId]`), 20ui.
 *
 * Server entry: fetches the refund and its parent transaction in
 * parallel through the gated actions (the parent supplies the line
 * names the refunded indices join against), then renders the
 * DocDetailPage-based {@link PosRefundDetailClient} with a vocab-guarded
 * status transition and a "parent transaction" related rail.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import {
  getSabcrmPosRefund,
  getSabcrmPosTransaction,
} from '@/app/actions/sabcrm-commerce-docs.actions';
import { PosRefundDetailClient } from './pos-refund-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS refund — SabCRM Commerce',
};

interface PageProps {
  params: Promise<{ refundId: string }>;
}

export default async function SabcrmCommercePosRefundDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { refundId } = await params;

  const refundRes = await getSabcrmPosRefund(refundId);
  if (!refundRes.ok) {
    notFound();
  }
  const refund = refundRes.data;

  const txnRes = await getSabcrmPosTransaction(refund.originalTransactionId);

  // The original transaction's line names, indexed for the join.
  const originalLines = txnRes.ok
    ? txnRes.data.lineItems.map((li) => ({ name: li.name, rate: li.rate }))
    : [];
  const transactionNumber = txnRes.ok ? txnRes.data.transactionNumber : null;

  return (
    <PosRefundDetailClient
      refund={refund}
      originalLines={originalLines}
      transactionNumber={transactionNumber}
    />
  );
}
