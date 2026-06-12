/**
 * SabCRM Finance — Debit note detail
 * (`/sabcrm/finance/debit-notes/[id]`).
 *
 * Server entry for the debit-note document detail (finance-rollout spec
 * §3.5). Fetches the note, its vendor (resolved label — never a raw
 * ObjectId) and the lineage rail (linked bill + lineage parents) in
 * parallel, then hands everything to the detail client.
 */

import * as React from 'react';

import {
  getSabcrmDebitNoteFull,
  getSabcrmDebitNoteRelated,
} from '@/app/actions/sabcrm-finance-debit-notes.actions';
import { resolveSabcrmFinanceVendors } from '@/app/actions/sabcrm-finance-pickers.actions';
import { DebitNoteDetailClient } from './debit-note-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Debit note — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SabcrmFinanceDebitNoteDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const noteRes = await getSabcrmDebitNoteFull(id);
  if (!noteRes.ok) {
    return (
      <DebitNoteDetailClient
        note={null}
        vendor={null}
        related={[]}
        error={noteRes.error}
      />
    );
  }

  const [vendorRes, relatedRes] = await Promise.all([
    noteRes.data.vendorId
      ? resolveSabcrmFinanceVendors([noteRes.data.vendorId])
      : Promise.resolve(null),
    getSabcrmDebitNoteRelated(id),
  ]);

  return (
    <DebitNoteDetailClient
      note={noteRes.data}
      vendor={vendorRes?.ok ? (vendorRes.data[0] ?? null) : null}
      related={relatedRes.ok ? relatedRes.data : []}
      error={null}
    />
  );
}
