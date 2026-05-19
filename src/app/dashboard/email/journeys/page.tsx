import { Suspense } from 'react';
import { ZoruSkeleton, RouteComingSoon } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';

export default function EmailJourneysPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <RouteComingSoon
          title="Journeys"
          description="Build behavioural and lifecycle journeys with the visual canvas — shipping in Phase 5."
          parentHref="/dashboard/email"
          parentLabel="Back to email overview"
        />
      </Suspense>
    </EmailSuiteLayout>
  );
}
