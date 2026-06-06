'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function IntegrationError({
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
      title="Error"
      eyebrow="INTEGRATION"
      back={{ href: '/dashboard/crm/integrations', label: 'Back to integrations' }}
    >
      <EmptyState
        icon={AlertCircle}
        title="Failed to load integration"
        description="An error occurred while loading this integration's details."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityDetailShell>
  );
}
