'use client';

import * as React from 'react';
import { Send } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, Button, EmptyState } from '@/components/sabcrm/20ui';

export default function BulkSendPage() {
  return (
    <EntityListShell
      title="Bulk Send"
      subtitle="Manage bulk send for your e-signature workflows."
    >
      <Card variant="outlined" padding="lg">
        <EmptyState
          icon={Send}
          title="Bulk Send feature coming soon."
          description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
          action={<Button variant="outline">Learn More</Button>}
        />
      </Card>
    </EntityListShell>
  );
}
