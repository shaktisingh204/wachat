'use client';

import * as React from 'react';
import { BarChart3 } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function ReportsPage() {
  return (
    <EntityListShell
      title="Analytics & Reports"
      subtitle="Manage analytics & reports for your e-signature workflows."
      empty={
        <EmptyState
          icon={BarChart3}
          title="Analytics & Reports feature coming soon."
          description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
          action={<Button variant="outline">Learn more</Button>}
        />
      }
    >
      {null}
    </EntityListShell>
  );
}
