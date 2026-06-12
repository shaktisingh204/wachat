/**
 * SabCRM Finance — Petty-cash float detail (`/sabcrm/finance/petty-cash/[id]`).
 *
 * Server entry: fetches the float and (when the custodian is a real CRM
 * person record) the resolved custodian contact in parallel, then hands
 * everything to the detail client.
 */

import * as React from 'react';

import { getSabcrmPettyCashFloatFull } from '@/app/actions/sabcrm-finance-petty-cash.actions';
import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import { PettyCashDetailClient } from './petty-cash-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Petty cash float — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const isRecordId = (s: string | undefined): boolean =>
  !!s && /^[0-9a-fA-F]{24}$/.test(s);

export default async function SabcrmFinancePettyCashDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const floatRes = await getSabcrmPettyCashFloatFull(id);
  if (!floatRes.ok) {
    return (
      <PettyCashDetailClient
        float={null}
        custodian={null}
        error={floatRes.error}
      />
    );
  }

  const contactRes = isRecordId(floatRes.data.custodianId)
    ? await getSabcrmFinancePartyContact(floatRes.data.custodianId as string)
    : null;

  return (
    <PettyCashDetailClient
      float={floatRes.data}
      custodian={contactRes?.ok ? contactRes.data : null}
      error={null}
    />
  );
}
