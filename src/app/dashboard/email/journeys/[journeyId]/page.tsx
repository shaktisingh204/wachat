import { Suspense } from 'react';
import { Skeleton, Card } from '@/components/sabcrm/20ui/compat';
import { EmailSuiteLayout } from '@/components/email/layout';
import { JourneyDetailClient } from '@/components/email/journeys/journey-detail-client';

interface PageProps {
  params: Promise<{ journeyId: string }>;
}

function JourneyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
         <Card className="p-6 h-[600px]">
            <div className="flex flex-col items-center gap-4">
               <Skeleton className="h-16 w-64 rounded-xl" />
               <div className="h-8 w-px bg-border" />
               <Skeleton className="h-16 w-64 rounded-xl" />
            </div>
         </Card>
         <Card className="p-6 h-[600px]" />
      </div>
    </div>
  );
}

export default async function EmailJourneyDetailPage({ params }: PageProps) {
  const { journeyId } = await params;
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<JourneyDetailSkeleton />}>
        <JourneyDetailClient journeyId={journeyId} />
      </Suspense>
    </EmailSuiteLayout>
  );
}
