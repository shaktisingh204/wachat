/**
 * SabCRM Finance — TDS records (`/sabcrm/finance/tds`), 20ui.
 *
 * Server entry: lists the active project's quarterly TDS deduction
 * records through the gated `listSabcrmTdsRecords` action (crate
 * `crm-tds`, `/v1/sabcrm/finance/tds` — this crate previously had NO
 * `/v1/crm` mount; only the project router is mounted). Renders via
 * the shared {@link FinanceLedgerClient}.
 */

import * as React from 'react';

import { listSabcrmTdsRecords } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'TDS records — SabCRM Finance',
};

export default async function SabcrmFinanceTdsPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmTdsRecords({ limit: 100 });

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: `${doc.employeeName} ${doc.financialYear} ${doc.quarter}`,
        status: doc.status ?? 'pending',
        currency: 'INR',
        cells: {
          employeeName: doc.employeeName,
          financialYear: doc.financialYear,
          quarter: doc.quarter,
          grossAmount: doc.grossAmount ?? 0,
          tdsAmount: doc.tdsAmount ?? 0,
          challan: doc.depositChallanNumber ?? '',
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="tds"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
