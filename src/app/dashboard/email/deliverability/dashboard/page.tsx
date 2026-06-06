import { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { DeliverabilityDashboardClient } from '@/components/email/deliverability/dashboard/deliverability-dashboard-client';

export const dynamic = 'force-dynamic';

export default function DeliverabilityDashboardPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DeliverabilityDashboardClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
