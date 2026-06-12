/**
 * SabCRM Finance — Quotation detail (`/sabcrm/finance/quotations/[id]`).
 *
 * Server entry. Fetches the quotation, its linked customer contact
 * (label + email — never a raw ObjectId) and the lineage rail (deal /
 * lead parents + conversion children) in parallel, then hands
 * everything to the detail client.
 */

import * as React from 'react';

import { getSabcrmQuotation } from '@/app/actions/sabcrm-finance.actions';
import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import { getSabcrmQuotationRelated } from '@/app/actions/sabcrm-finance-quotations.actions';
import { QuotationDetailClient } from './quotation-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quotation — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceQuotationDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const quotationRes = await getSabcrmQuotation(id);
  if (!quotationRes.ok) {
    return (
      <QuotationDetailClient
        quotation={null}
        contact={null}
        related={[]}
        error={quotationRes.error}
      />
    );
  }

  const [contactRes, relatedRes] = await Promise.all([
    getSabcrmFinancePartyContact(quotationRes.data.clientId),
    getSabcrmQuotationRelated(id),
  ]);

  return (
    <QuotationDetailClient
      quotation={quotationRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
