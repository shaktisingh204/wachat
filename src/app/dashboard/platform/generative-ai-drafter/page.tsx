export const dynamic = "force-dynamic";

import { getGenerativeAIDrafts } from '@/app/actions/platform/generative-ai-drafter.actions';
import GenerativeAIDrafterClientPage from './client-page';
import { Suspense } from 'react';
import {
  Card,
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  Skeleton,
} from '@/components/sabcrm/20ui';

export const metadata = {
  title: 'Generative AI Drafter | SabNode Platform',
};

function DrafterFallback() {
  return (
    <div className="20ui flex w-full flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading AI drafts</span>
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>Platform · AI</PageEyebrow>
          <PageTitle>Generative AI drafter</PageTitle>
          <PageDescription>
            Draft emails, proposals, and contracts with AI, then review before they ship.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} padding="md">
            <Skeleton width={36} height={36} radius={8} />
            <Skeleton width="50%" height={12} className="mt-3" />
            <Skeleton width="35%" height={20} className="mt-2" />
          </Card>
        ))}
      </div>
      <Card padding="lg">
        <Skeleton width="20%" height={14} />
        <Skeleton width="90%" height={64} className="mt-4" radius="var(--st-radius)" />
      </Card>
    </div>
  );
}

export default async function GenerativeAIDrafterPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const limit = 10;
  const { drafts, total } = await getGenerativeAIDrafts(page, limit);

  return (
    <Suspense fallback={<DrafterFallback />}>
      <GenerativeAIDrafterClientPage
        initialData={drafts}
        total={total}
        currentPage={page}
        limit={limit}
      />
    </Suspense>
  );
}
