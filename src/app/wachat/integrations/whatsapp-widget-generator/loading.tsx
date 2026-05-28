'use client';

import { Skeleton, Card } from '@/components/zoruui';

export default function IntegrationsWhatsappWidgetGeneratorLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-1/4" />
      <Skeleton className="h-4 w-2/4" />
      <Card className="p-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </Card>
    </div>
  );
}