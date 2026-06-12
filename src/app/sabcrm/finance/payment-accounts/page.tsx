/**
 * SabCRM Finance — Payment accounts
 * (`/sabcrm/finance/payment-accounts`), 20ui.
 *
 * Server entry: lists the active project's payment accounts through the
 * gated `listSabcrmPaymentAccounts` action (session → project → RBAC →
 * plan gate, then `/v1/sabcrm/finance/payment-accounts`). NB: this is a
 * crm-common-style crate — the action already unwraps the
 * `{ items, … }` list envelope, and delete is an archive.
 */

import * as React from 'react';

import { listSabcrmPaymentAccounts } from '@/app/actions/sabcrm-finance.actions';
import {
  PaymentAccountsClient,
  type PaymentAccountRow,
} from './payment-accounts-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Payment accounts — SabCRM Finance',
};

export default async function SabcrmFinancePaymentAccountsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPaymentAccounts();

  const rows: PaymentAccountRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        name: doc.accountName,
        type: String(doc.accountType ?? ''),
        openingBalance: doc.openingBalance ?? 0,
        currency: doc.currency ?? 'INR',
        isDefault: Boolean(doc.isDefault),
        status: doc.status ?? 'active',
      }))
    : [];

  return (
    <PaymentAccountsClient
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
