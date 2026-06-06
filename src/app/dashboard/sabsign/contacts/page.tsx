'use client';

import * as React from 'react';
import { Contact } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Card, CardBody, Button, EmptyState } from '@/components/sabcrm/20ui';

export default function ContactsPage() {
  return (
    <EntityListShell
      title="Address Book"
      subtitle="Manage address book for your e-signature workflows."
    >
      <Card variant="outlined">
        <CardBody>
          <EmptyState
            icon={Contact}
            title="Address Book feature coming soon."
            description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
            action={<Button variant="outline">Learn More</Button>}
          />
        </CardBody>
      </Card>
    </EntityListShell>
  );
}
