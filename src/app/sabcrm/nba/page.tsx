/**
 * SabCRM — Next-Best-Action (`/sabcrm/nba`), 20ui.
 *
 * Server entry for the Insights suite's "what should I do right now" work
 * queue. Fetches the ranked queue once via the gated `getNbaQueueTw` action and
 * hands it to the client surface, which can re-fetch (refresh / toggle the
 * project-wide view) without a full navigation.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM `layout.tsx`.
 * `getNbaQueueTw` independently re-runs the full session → project → RBAC →
 * plan pipeline and normalises every failure (incl. a downed Rust engine) into
 * `{ ok: false, error }` or a degraded (smaller) queue, so the route never
 * crashes.
 */

import * as React from 'react';

import { getNbaQueueTw } from '@/app/actions/sabcrm-nba.actions';
import { NbaClient } from './nba-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Next best action — SabCRM',
};

export default async function SabcrmNbaPage(): Promise<React.JSX.Element> {
  const res = await getNbaQueueTw(undefined, { limit: 60 });

  return (
    <NbaClient
      initialQueue={res.ok ? res.data.queue : []}
      initialSummary={res.ok ? res.data.summary : null}
      initialComputedAt={res.ok ? res.data.computedAt : null}
      initialError={res.ok ? null : res.error}
    />
  );
}
