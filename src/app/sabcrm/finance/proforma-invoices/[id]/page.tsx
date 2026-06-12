/**
 * SabCRM Finance — Proforma detail
 * (`/sabcrm/finance/proforma-invoices/[id]`).
 *
 * Server entry. Fetches the proforma, its linked customer contact
 * (label + email — never a raw ObjectId) and the related rail (linked
 * sales-order parent) in parallel, then hands everything to the detail
 * client.
 */

import * as React from 'react';

import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  getSabcrmProformaDoc,
  getSabcrmProformaRelated,
} from '@/app/actions/sabcrm-finance-proforma.actions';
import { ProformaDetailClient } from './proforma-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Proforma invoice — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceProformaDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const proformaRes = await getSabcrmProformaDoc(id);
  if (!proformaRes.ok) {
    return (
      <ProformaDetailClient
        proforma={null}
        contact={null}
        related={[]}
        error={proformaRes.error}
      />
    );
  }

  const [contactRes, relatedRes] = await Promise.all([
    proformaRes.data.accountId
      ? getSabcrmFinancePartyContact(proformaRes.data.accountId)
      : Promise.resolve({ ok: true as const, data: null }),
    getSabcrmProformaRelated(id),
  ]);

  return (
    <ProformaDetailClient
      proforma={proformaRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
