/**
 * SabCRM Finance — Debit notes (`/sabcrm/finance/debit-notes`).
 *
 * Server entry for the doc-surface vertical (finance-rollout spec §3.5).
 * Fetches page 1 of display-ready rows (vendor labels resolved
 * server-side — no ObjectIds reach the client) plus the KPI strip in
 * parallel through the gated actions, then hands everything to the
 * kit-driven client.
 *
 * Deep links:
 *   - `?q= / ?status= / ?partyId= / ?from= / ?to=` seed the toolbar
 *     filters AND the initial fetch (statements drill-down, §1.4) —
 *     `partyId` filters by vendor;
 *   - `?fromBill=<id>` prefils the create drawer (linked bill + vendor
 *     + currency) for the bill → debit-note convert.
 *
 * Auth / onboarding / RBAC are enforced by the parent SabCRM layout;
 * every action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';

import {
  getSabcrmDebitNoteKpis,
  getSabcrmDebitNotePrefillFromBill,
  listSabcrmDebitNotesPage,
} from '@/app/actions/sabcrm-finance-debit-notes.actions';
import type { DebitNoteStatus } from '@/lib/rust-client/crm-debit-notes';
import { DebitNotesClient } from './debit-notes-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Debit notes — SabCRM Finance',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function SabcrmFinanceDebitNotesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q) ?? '';
  const status = (first(params.status) ?? '') as DebitNoteStatus | '';
  const partyId = first(params.partyId) ?? '';
  const from = first(params.from);
  const to = first(params.to);
  const fromBill = first(params.fromBill);

  const [pageRes, kpiRes, prefillRes] = await Promise.all([
    listSabcrmDebitNotesPage({
      page: 1,
      q: q || undefined,
      status,
      vendorId: partyId || undefined,
      from,
      to,
    }),
    getSabcrmDebitNoteKpis(),
    fromBill
      ? getSabcrmDebitNotePrefillFromBill(fromBill)
      : Promise.resolve(null),
  ]);

  return (
    <DebitNotesClient
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
