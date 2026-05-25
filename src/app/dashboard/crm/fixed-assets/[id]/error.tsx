'use client';

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState } from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function FixedAssetError({
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
    <EntityDetailShell title="Fixed Asset" back={{ href: '/dashboard/crm/fixed-assets', label: 'Back to Fixed Assets' }}>
      <EmptyState
        icon={AlertCircle}
        title="Failed to load fixed asset"
        description="An error occurred while loading this fixed asset."
        action={<Button onClick={() => reset()}>Try again</Button>}
      />
    </EntityDetailShell>
  );
}
