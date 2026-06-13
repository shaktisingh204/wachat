/**
 * SabCRM Commerce — POS session detail
 * (`/sabcrm/commerce/pos-sessions/[sessionId]`), 20ui.
 *
 * Server entry: fetches one session + its transactions (filtered
 * `sessionId`) in parallel through the gated actions and renders the
 * bespoke cash-summary {@link PosSessionDetailClient} — StatusFlow
 * header, opening/expected/closing/discrepancy cash cards, a
 * transactions table and Close / Reconcile dialogs.
 */

import * as React from 'react';
import { notFound } from 'next/navigation';

import { getSabcrmPosSession } from '@/app/actions/sabcrm-commerce-docs.actions';
import { listSabcrmPosTransactions } from '@/app/actions/sabcrm-commerce.actions';
import { posSessionToRow } from '@/app/actions/sabcrm-commerce-pos-sessions.actions.types';
import { PosSessionDetailClient } from './pos-session-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS session — SabCRM Commerce',
};

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SabcrmCommercePosSessionDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { sessionId } = await params;

  const [sessionRes, txnRes] = await Promise.all([
    getSabcrmPosSession(sessionId),
    listSabcrmPosTransactions({ sessionId, limit: 100 }),
  ]);

  if (!sessionRes.ok) {
    notFound();
  }

  const txns = txnRes.ok
    ? txnRes.data.map((t) => ({
        id: t._id,
        transactionNumber: t.transactionNumber,
        createdAt: t.createdAt,
        total: t.total ?? 0,
        paymentMethod: t.paymentMethod,
        status: t.status,
      }))
    : [];

  return (
    <PosSessionDetailClient
      session={posSessionToRow(sessionRes.data)}
      transactions={txns}
    />
  );
}
