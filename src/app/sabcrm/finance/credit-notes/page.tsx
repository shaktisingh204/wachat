/**
 * SabCRM Finance — Credit notes (`/sabcrm/finance/credit-notes`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec §3.4).
 * Fetches page 1 of display-ready rows (party labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client.
 *
 * Deep links:
 *   - `?q= / ?status= / ?partyId= / ?from= / ?to=` seed the toolbar
 *     filters AND the initial fetch (statements drill-down, §1.4);
 *   - `?fromInvoice=<id>` prefils the create drawer (linked invoice +
 *     customer + currency) for the invoice → credit-note flow.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmCreditNoteKpis,
  getSabcrmCreditNotePrefillFromInvoice,
  listSabcrmCreditNotesPage,
} from '@/app/actions/sabcrm-finance-credit-notes.actions';
import type { CreditNoteStatus } from '@/lib/rust-client/crm-credit-notes';
import { CreditNotesClient } from './credit-notes-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Credit notes — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceCreditNotesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as CreditNoteStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);
  const fromInvoice = first(params.fromInvoice);

  const [pageRes, kpiRes, prefillRes] = await Promise.all([
    listSabcrmCreditNotesPage({
      page: 1,
      q: q || undefined,
      status,
      clientId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmCreditNoteKpis(),
    fromInvoice
      ? getSabcrmCreditNotePrefillFromInvoice(fromInvoice)
      : Promise.resolve(null),
  ]);

  return (
    <CreditNotesClient
      initialRows={pageRes.ok ? pageRes.data.rows : []}
      initialHasMore={pageRes.ok ? pageRes.data.hasMore : false}
      initialError={pageRes.ok ? null : pageRes.error}
      kpis={kpiRes.ok ? kpiRes.data : null}
      initialFilters={
        q || status || partyId || from || to
          ? { q, status, partyId, from, to }
          : undefined
      }
      prefill={prefillRes?.ok ? prefillRes.data : null}
    />
  );
}
