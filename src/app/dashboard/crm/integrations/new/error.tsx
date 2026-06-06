'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function NewIntegrationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EntityDetailShell 
      title="New custom integration"
      eyebrow="INTEGRATION"
      back={{ href: '/dashboard/crm/integrations', label: 'Integrations' }}
    >
      <EmptyState
        icon={AlertCircle}
        title="Error Loading Form"
        description="An error occurred while loading the integration form."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityDetailShell>
  );
}
