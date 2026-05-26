import { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { EmailSuiteLayout } from '@/components/email/layout';
import { CampaignAnalyticsClient } from '@/components/email/campaigns/campaign-analytics-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignAnalyticsPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <EmailSuiteLayout>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CampaignAnalyticsClient campaignId={id} />
      </Suspense>
    </EmailSuiteLayout>
  );
}
