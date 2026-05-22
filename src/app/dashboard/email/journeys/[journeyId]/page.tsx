import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { JourneyDetailClient } from '@/components/email/journeys/journey-detail-client';

interface PageProps {
  params: Promise<{ journeyId: string }>;
}

export default async function EmailJourneyDetailPage({ params }: PageProps) {
  const { journeyId } = await params;
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <JourneyDetailClient journeyId={journeyId} />
      </Suspense>
    </EmailSuiteLayout>
  );
}
