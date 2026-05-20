/**
 * GSTR-1 — `/dashboard/crm/tax/gstr1`
 *
 * Server component. Thin wrapper that renders `<Gstr1Client>` which
 * owns the period picker, generate flow, KPI summary strip, section
 * cards, and the JSON / GSTN download buttons.
 *
 * The page itself has no server-side data to pre-fetch (the action is
 * triggered client-side based on the period the user picks), so it is
 * a minimal shell.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Gstr1Client } from './_components/gstr1-client';

export const dynamic = 'force-dynamic';

export default function Gstr1Page() {
  return (
    <EntityListShell
      title="GSTR-1"
      subtitle="Outward supplies — generate the monthly return JSON for the GST portal."
    >
      <Gstr1Client />
    </EntityListShell>
  );
}
