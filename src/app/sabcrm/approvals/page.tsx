/**
 * SabCRM — Approvals inbox (`/sabcrm/approvals`), 20ui.
 *
 * Server entry for the stage-gate approval work queue. All data flows
 * client-side (the list re-fetches per status tab / page / active project),
 * so this page only mounts the client component.
 *
 * Auth / onboarding / RBACGuard are enforced by the parent SabCRM
 * `layout.tsx`; every server action the client calls re-runs the full
 * session → project → RBAC → plan gate.
 */

import * as React from 'react';

import { ApprovalsClient } from './approvals-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Approvals — SabCRM',
};

export default function SabcrmApprovalsPage(): React.JSX.Element {
  return <ApprovalsClient />;
}
