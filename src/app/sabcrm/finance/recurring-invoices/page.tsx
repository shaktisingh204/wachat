/**
 * SabCRM Finance — Recurring invoices
 * (`/sabcrm/finance/recurring-invoices`), 20ui.
 *
 * Server entry: lists the active project's invoice schedules through the
 * gated `listSabcrmRecurringInvoices` action. Renders via the shared
 * {@link FinanceLedgerClient}; the row action toggles a schedule between
 * `active` and `paused` (`updateSabcrmRecurringInvoice`).
 */

import * as React from 'react';

import { listSabcrmRecurringInvoices } from '@/app/actions/sabcrm-finance.actions';
import {
  FinanceLedgerClient,
  type LedgerRow,
} from '../_components/finance-ledger-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recurring invoices — SabCRM Finance',
};

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

export default async function SabcrmFinanceRecurringInvoicesPage(): Promise<React.JSX.Element> {
  const res = await listSabcrmRecurringInvoices();

  const rows: LedgerRow[] = res.ok
    ? res.data.map((doc) => ({
        id: doc._id,
        label: doc.title || `…${doc._id.slice(-8)}`,
        status: doc.status,
        currency: 'INR',
        cells: {
          title: doc.title ?? '',
          frequency: FREQUENCY_LABEL[doc.frequency] ?? doc.frequency,
          startDate: doc.startDate ?? '',
          nextRunAt: doc.nextRunAt ?? '',
        },
      }))
    : [];

  return (
    <FinanceLedgerClient
      kind="recurring-invoices"
      initialRows={rows}
      initialError={res.ok ? null : res.error}
    />
  );
}
