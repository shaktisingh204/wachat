/**
 * /dashboard/crm/automations/docs
 *
 * Server component — fetches KPIs + automation list, then hands off
 * to <AutomationsDocsClient> which renders three tabs:
 *   1. My Automations — live table with bulk enable/disable + export
 *   2. Documentation — static accordion of triggers, actions, logic
 *   3. Templates — grid of pre-built automation templates
 */

import * as React from 'react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCrmAutomationKpis,
  listCrmAutomations,
} from '@/app/actions/crm-automations.actions';
import { AutomationsDocsClient } from './_components/automations-docs-client';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function AutomationsDocsData() {
  const [kpis, { items, total }] = await Promise.all([
    getCrmAutomationKpis(),
    listCrmAutomations(1, 20),
  ]);

  return (
    <AutomationsDocsClient
      kpis={kpis}
      initialAutomations={items}
      initialTotal={total}
    />
  );
}

export default function CrmAutomationDocsPage() {
  return (
    <EntityListShell
      title="Automations"
      subtitle="Manage, document and discover pre-built automations for your CRM workflows."
    >
      <React.Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-zoru-ink-muted" />
          </div>
        }
      >
        <AutomationsDocsData />
      </React.Suspense>
    </EntityListShell>
  );
}
