/**
 * SabCRM — Shared inbox (`/sabcrm/inbox`), 20ui.
 *
 * Server entry for the shared CRM inbox: one surface showing recent SabMail
 * messages mapped to the CRM record each one corresponds to (by from-address),
 * with an inline quick reply that rides the record-detail send path.
 *
 * The initial rows are fetched server-side through the gated `getCrmInboxTw`
 * action (read-only aggregator over SabMail accounts + the Rust record-match
 * path). Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; the action re-runs the full session → project → RBAC → plan
 * gate. Everything degrades gracefully — no SabMail account / engine down
 * returns `{ rows: [], connected: false }`, which the client renders as a
 * connect-SabMail empty state instead of crashing.
 */

import * as React from 'react';

import { getCrmInboxTw } from '@/app/actions/sabcrm-inbox.actions';
import type { CrmInboxResult } from '@/lib/sabcrm/crm-inbox.server';
import { InboxClient } from './inbox-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Inbox — SabCRM',
};

const EMPTY: CrmInboxResult = {
  rows: [],
  accountsScanned: 0,
  connected: false,
  reason: 'no-accounts',
};

export default async function SabcrmInboxPage(): Promise<React.JSX.Element> {
  const res = await getCrmInboxTw();
  return (
    <InboxClient
      initial={res.ok ? res.data : EMPTY}
      initialError={res.ok ? null : res.error}
    />
  );
}
