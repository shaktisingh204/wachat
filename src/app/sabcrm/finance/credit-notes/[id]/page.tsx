/**
 * SabCRM Finance — Credit note detail
 * (`/sabcrm/finance/credit-notes/[id]`).
 *
 * Server entry for the credit-note document detail (finance-rollout
 * spec §3.4). Fetches the note, its linked customer contact (label +
 * email — never a raw ObjectId) and the lineage rail (linked invoice +
 * lineage parents) in parallel, then hands everything to the detail
 * client.
 */

import * as React from 'react';

import {
  getSabcrmCreditNoteFull,
  getSabcrmCreditNoteRelated,
} from '@/app/actions/sabcrm-finance-credit-notes.actions';
import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import { CreditNoteDetailClient } from './credit-note-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Credit note — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceCreditNoteDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const noteRes = await getSabcrmCreditNoteFull(id);
  if (!noteRes.ok) {
    return (
      <CreditNoteDetailClient
        note={null}
        contact={null}
        related={[]}
        error={noteRes.error}
      />
    );
  }

  const [contactRes, relatedRes] = await Promise.all([
    getSabcrmFinancePartyContact(noteRes.data.clientId),
    getSabcrmCreditNoteRelated(id),
  ]);

  return (
    <CreditNoteDetailClient
      note={noteRes.data}
      contact={contactRes.ok ? contactRes.data : null}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
