/**
 * SabCRM Finance — Expenses (`/sabcrm/finance/expenses`), 20ui.
 *
 * Server entry: lists the active project's expense claims through the
 * gated `listSabcrmExpenses` action (crate `crm-expense-claims`,
 * `/v1/sabcrm/finance/expenses`). The claim fits the generic document
 * mould (number/party/date/amount/status), so it renders via the shared
 * {@link FinanceDocClient}.
 */

import * as React from 'react';

import { listSabcrmExpenses } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceDocClient,
  type FinanceDocRow,
} from '../_components/finance-doc-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expenses — SabCRM Finance',
};

export default async function SabcrmFinanceExpensesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmExpenses();

  const rows: FinanceDocRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        number: doc.claim_number,
        party: doc.employee_name || doc.employee_id,
        date: doc.expense_date ?? doc.createdAt ?? '',
        amount: doc.amount,
        currency: doc.currency ?? 'INR',
        status: doc.status,
      }))
    : [];

  return (
    <FinanceDocClient
      kind="expenses"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
