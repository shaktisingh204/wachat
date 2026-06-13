/**
 * SabCRM — Data health (`/sabcrm/data-quality`), 20ui.
 *
 * Server entry for the data-quality dashboard. Grades every non-system object's
 * records on completeness / validity / freshness via the gated
 * `getProjectDataHealthTw` action (the pure scorer is
 * `@/lib/sabcrm/data-quality-score`; the runtime + write-back envelope is
 * `…-score.server`), then hands flat serialisable summaries to the client
 * component for the per-object cards + worst-records table.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; the action independently re-runs the full
 * session → project → RBAC(`view`) → plan gate. The Rust engine / DB may be
 * down at dev time — the action normalises that into `{ ok: false, error }`,
 * which renders as an inline error state instead of crashing the route.
 */

import * as React from 'react';

import { getProjectDataHealthTw } from '@/app/actions/sabcrm-dataquality.actions';
import DataQualityClient from './data-quality-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Data health — SabCRM',
};

export default async function SabcrmDataQualityPage(): Promise<React.JSX.Element> {
  const res = await getProjectDataHealthTw();

  return (
    <DataQualityClient
      initialSummaries={res.ok ? res.data : []}
      initialError={res.ok ? null : res.error}
    />
  );
}
