'use client';

import * as React from 'react';
import { CreditCard } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Button, EmptyState } from '@/components/sabcrm/20ui';

export default function BillingPage() {
  return (
    <EntityListShell
      title="Billing & Usage"
      subtitle="Manage billing and usage for your e-signature workflows."
    >
      <EmptyState
        icon={CreditCard}
        title="Billing and Usage feature coming soon."
        description="This module is part of the 100+ feature expansion. You will be able to configure advanced settings, view metrics, and manage integrations here."
        action={<Button variant="outline">Learn more</Button>}
      />
    </EntityListShell>
  );
}
