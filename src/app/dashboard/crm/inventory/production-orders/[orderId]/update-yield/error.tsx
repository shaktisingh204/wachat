'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Button, Card } from '@/components/zoruui';
import { AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const { orderId } = useParams<{ orderId: string }>();

  return (
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title="Update yield"
      back={{ href: `/dashboard/crm/inventory/production-orders/${orderId}`, label: 'Back to order' }}
    >
      <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center h-64">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Something went wrong</h3>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Failed to load update yield form.'}
          </p>
        </div>
        <Button onClick={() => reset()} variant="outline">
          Try again
        </Button>
      </Card>
    </EntityDetailShell>
  );
}
