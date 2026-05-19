import { Suspense } from 'react';
import { ZoruSkeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { JourneysClient } from '@/components/email/journeys/journeys-client';

export default function EmailJourneysPage() {
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<ZoruSkeleton className="h-96 w-full" />}>
        <JourneysClient />
      </Suspense>
    </EmailSuiteLayout>
  );
}
