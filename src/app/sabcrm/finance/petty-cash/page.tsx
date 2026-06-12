/**
 * SabCRM Finance — Petty cash (`/sabcrm/finance/petty-cash`), 20ui.
 *
 * Server entry: lists the active project's petty cash floats through the
 * gated `listSabcrmPettyCashFloats` action (crate `crm-petty-cash`,
 * `/v1/sabcrm/finance/petty-cash`). Renders via the shared
 * {@link FinanceLedgerClient}.
 */

import * as React from 'react';

import { listSabcrmPettyCashFloats } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Petty cash — SabCRM Finance',
};

export default async function SabcrmFinancePettyCashPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmPettyCashFloats();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: doc.branchName || doc.custodianName || `…${doc._id.slice(-8)}`,
        status: doc.status ?? 'active',
        currency: doc.currency ?? 'INR',
        cells: {
          branch: doc.branchName ?? '',
          custodian: doc.custodianName ?? '',
          openingBalance: doc.openingBalance,
          currentBalance: doc.currentBalance ?? doc.openingBalance,
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="petty-cash"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
