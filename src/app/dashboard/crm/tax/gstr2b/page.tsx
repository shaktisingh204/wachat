'use server';

/**
 * GSTR-2B — `/dashboard/crm/tax/gstr2b`
 *
 * Thin server wrapper — the action is triggered client-side based on
 * the period the user picks, so there's no server-side data to
 * pre-fetch here.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Gstr2bClient } from './_components/gstr2b-client';

export const dynamic = 'force-dynamic';

export default function Gstr2bPage() {
  return (
    <EntityListShell
      title="GSTR-2B"
      subtitle="Auto-drafted ITC statement — upload the JSON exported from the GST portal."
    >
      <Gstr2bClient />
    </EntityListShell>
  );
}
