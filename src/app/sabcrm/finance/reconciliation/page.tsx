/**
 * SabCRM Finance — Reconciliation
 * (`/sabcrm/finance/reconciliation`), 20ui.
 *
 * Server entry: lists the active project's bank-reconciliation runs
 * through the gated `listSabcrmReconciliations` action (crate
 * `crm-reconciliation`, `/v1/sabcrm/finance/reconciliation`). Read-heavy
 * surface — sessions are listed with balances and match counts; the
 * statement-line matching workflow is a follow-up. Renders via the
 * shared {@link FinanceLedgerClient}.
 */

import * as React from 'react';

import { listSabcrmReconciliations } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reconciliation — SabCRM Finance',
};

export default async function SabcrmFinanceReconciliationPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmReconciliations();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: `…${doc.accountId.slice(-8)}`,
        status: doc.status,
        currency: 'INR',
        cells: {
          account: `…${doc.accountId.slice(-8)}`,
          periodStart: doc.periodStart,
          periodEnd: doc.periodEnd,
          openingBalance: doc.openingBalance,
          closingBalance: doc.closingBalance,
          matched: doc.matchedCount,
          unmatched: doc.unmatchedCount,
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="reconciliation"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
