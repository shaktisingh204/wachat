/**
 * SabCRM Finance — Voucher books (`/sabcrm/finance/vouchers`), 20ui.
 *
 * Server entry: lists the active project's voucher numbering series
 * through the gated `listSabcrmVoucherBooks` action (crate
 * `crm-vouchers`, `/v1/sabcrm/finance/vouchers`). NB: this crate stores
 * the BOOKS (prefix + counter series); line-based journal voucher
 * ENTRIES live in `crm-voucher-entries` and are a follow-up surface.
 * Renders via the shared {@link FinanceLedgerClient}.
 */

import * as React from 'react';

import { listSabcrmVoucherBooks } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Voucher books — SabCRM Finance',
};

const TYPE_LABEL: Record<string, string> = {
  journal: 'Journal',
  payment: 'Payment',
  receipt: 'Receipt',
  contra: 'Contra',
  purchase: 'Purchase',
  sales: 'Sales',
};

export default async function SabcrmFinanceVouchersPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmVoucherBooks();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: doc.name,
        status: doc.status ?? (doc.isActive === false ? 'archived' : 'active'),
        currency: 'INR',
        cells: {
          name: doc.name,
          type: TYPE_LABEL[doc.type] ?? doc.type,
          prefix: doc.prefix ?? '',
          startingNumber: doc.startingNumber ?? 1,
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="vouchers"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
