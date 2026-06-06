'use client';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card } from '@/components/sabcrm/20ui';
import { LoaderCircle } from 'lucide-react';

import { useParams } from 'next/navigation';

export default function Loading() {
  const { orderId } = useParams<{ orderId: string }>();

  return (
    <EntityDetailShell
      eyebrow="PRODUCTION ORDER"
      title="Update yield"
      back={{ href: `/dashboard/crm/inventory/production-orders/${orderId}`, label: 'Back to order' }}
    >
      <Card className="flex h-64 items-center justify-center p-6">
        <LoaderCircle className="h-8 w-8 animate-spin text-[var(--st-text-secondary)]" />
      </Card>
    </EntityDetailShell>
  );
}
