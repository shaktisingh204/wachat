/**
 * SabCRM Commerce — POS transactions
 * (`/sabcrm/commerce/pos-transactions`), 20ui.
 *
 * Server entry: lists the active project's register sales through the
 * gated `listSabcrmPosTransactions` action (crate `crm-pos`,
 * `/v1/sabcrm/commerce/pos/transactions`). Read-heavy surface — rows
 * are created at the register; void is the only lifecycle action here.
 */

import * as React from 'react';

import { listSabcrmPosTransactions } from '@/app/actions/sabcrm-commerce.actions';
import {
  CommerceClient,
  type CommerceRow,
} from '../_components/commerce-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'POS transactions — SabCRM Commerce',
};

export default async function SabcrmCommercePosTransactionsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPosTransactions({ limit: 100 });
  const docs = res.ok ? res.data : [];

  const rows: CommerceRow[] = docs.map((doc) => ({
    id: doc._id,
    label: doc.transactionNumber,
    status: doc.status,
    currency: 'INR',
    cells: {
      transactionNumber: doc.transactionNumber,
      createdAt: doc.createdAt,
      lines: doc.lineItems?.length ?? 0,
      paymentMethod: doc.paymentMethod,
      total: doc.total,
    },
  }));

  return (
    <CommerceClient
      kind="pos-transactions"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
