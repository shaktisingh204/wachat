/**
 * SabCRM Finance — Invoice detail (`/sabcrm/finance/invoices/[id]`).
 *
 * Server entry for the flagship document detail surface. Fetches the
 * invoice, its linked customer contact (label + email — never a raw
 * ObjectId), the lineage rail (parents + payment-receipt children) and
 * the project's payment-account options in parallel, then hands
 * everything to the detail client.
 */

import * as React from 'react';

import { getSabcrmInvoice } from '@/app/actions/sabcrm-finance.actions';
import {
  getSabcrmFinancePartyContact,
  getSabcrmInvoiceRelated,
  listSabcrmPaymentAccountOptions,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import { InvoiceDetailClient } from './invoice-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Invoice — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceInvoiceDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const invoiceRes = await getSabcrmInvoice(id);
  if (!invoiceRes.ok) {
    return (
      <InvoiceDetailClient
        invoice={null}
        contact={null}
        related={[]}
        paymentAccounts={[]}
        error={invoiceRes.error}
      />
    );
  }

  const [contactRes, relatedRes, accountsRes] = await Promise.all([
    getSabcrmFinancePartyContact(invoiceRes.data.clientId),
    getSabcrmInvoiceRelated(id),
    listSabcrmPaymentAccountOptions(),
  ]);

  return (
    <InvoiceDetailClient
      invoice={invoiceRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data : []}
      paymentAccounts={accountsRes.ok ? accountsRes.data : []}
      error={null}
    />
  );
}
