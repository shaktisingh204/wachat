/**
 * /dashboard/crm/automations/docs
 *
 * Server component — fetches KPIs + automation list, then hands off
 * to <AutomationsDocsClient> which renders three tabs:
 *   1. My Automations — live table with bulk enable/disable + export
 *   2. Documentation — static accordion of triggers, actions, logic
 *   3. Templates — grid of pre-built automation templates
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCrmAutomationKpis,
  listCrmAutomations,
} from '@/app/actions/crm-automations.actions';
import { AutomationsDocsClient } from './_components/automations-docs-client';

export const dynamic = 'force-dynamic';

export default async function CrmAutomationDocsPage() {
  const [kpis, { items, total }] = await Promise.all([
    getCrmAutomationKpis(),
    listCrmAutomations(1, 20),
  ]);

  return (
    <EntityListShell
      title="Automations"
      subtitle="Manage, document and discover pre-built automations for your CRM workflows."
    >
      <AutomationsDocsClient
        kpis={kpis}
        initialAutomations={items}
        initialTotal={total}
      />
    </EntityListShell>
  );
}
