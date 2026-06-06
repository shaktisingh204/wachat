'use client';

import * as React from 'react';
import { ShieldCheck } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, CardBody, EmptyState, Button } from '@/components/sabcrm/20ui';

export default function AuditTrailPage() {
  return (
    <EntityListShell
      title="Audit Trail"
      subtitle="Manage audit trail for your e-signature workflows."
    >
      <Card variant="outlined" padding="none">
        <CardBody>
          <EmptyState
            icon={ShieldCheck}
            title="Audit Trail feature coming soon."
            description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
            action={<Button variant="outline">Learn More</Button>}
          />
        </CardBody>
      </Card>
    </EntityListShell>
  );
}
