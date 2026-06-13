/**
 * SabCRM — Marketing attribution (`/sabcrm/attribution`), 20ui.
 *
 * Server entry for the Insights suite's attribution report: won-deal revenue
 * attributed to marketing sources / campaigns under a chosen model
 * (first / last / linear touch). Computed by the gated
 * `getAttributionReportTw` action over `sabcrm_touches` + the won deals in
 * `sabcrm_records` (see `@/lib/sabcrm/attribution.server`).
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; the action independently re-runs the full gate. The object
 * list seeds the scope selector. A read failure degrades to an inline error
 * via the client — the route never crashes.
 *
 * The object list is narrowed to flat serialisable rows so the `server-only`
 * action modules never enter the client bundle.
 */

import * as React from 'react';

import { getAttributionReportTw } from '@/app/actions/sabcrm-attribution.actions';
import { listObjectsTw } from '@/app/actions/sabcrm-objects.actions';
import {
  AttributionClient,
  type AttributionObjectOption,
} from './attribution-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Attribution — SabCRM',
};

export default async function SabcrmAttributionPage(): Promise<React.JSX.Element> {
  const [reportRes, objectsRes] = await Promise.all([
    getAttributionReportTw({ model: 'linear' }),
    listObjectsTw(),
  ]);

  const objects: AttributionObjectOption[] = objectsRes.ok
    ? objectsRes.data.map((o) => ({
        value: o.slug,
        label: o.labelPlural || o.slug,
      }))
    : [];

  return (
    <AttributionClient
      initialReport={reportRes.ok ? reportRes.data : null}
      initialError={reportRes.ok ? null : reportRes.error}
      objects={objects}
    />
  );
}
