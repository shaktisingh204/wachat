import { Suspense } from 'react';
import { ZoruSkeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailDeliverabilityPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Deliverability"
          description="Sender score, DNS verification, DKIM rotation, DMARC policy and inbox placement — shipping in Phase 7."
          parentHref="/dashboard/email"
          parentLabel="Back to email overview"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
