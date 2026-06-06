'use client';

import * as React from 'react';
import { Code2 } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, EmptyState, Button } from '@/components/sabcrm/20ui';

export default function ApiSettingsPage() {
  return (
    <EntityListShell
      title="Developer API"
      subtitle="Manage developer api for your e-signature workflows."
    >
      <Card variant="ghost" padding="none">
        <EmptyState
          icon={Code2}
          title="Developer API feature coming soon."
          description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
          action={<Button variant="outline">Learn More</Button>}
        />
      </Card>
    </EntityListShell>
  );
}
