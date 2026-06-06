export const dynamic = "force-dynamic";

import { getGenerativeAIDrafts } from '@/app/actions/platform/generative-ai-drafter.actions';
import GenerativeAIDrafterClientPage from './client-page';
import { Suspense } from 'react';
import { Spinner } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const metadata = {
  title: 'Generative AI Drafter | CRM',
};

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
    <Suspense fallback={
      <EntityListShell title="Generative AI Drafter" subtitle="Draft emails, proposals, and contracts instantly using AI." loading={true}>
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" label="Loading drafts" />
        </div>
      </EntityListShell>
    }>
      <GenerativeAIDrafterClientPage initialData={drafts} total={total} currentPage={page} limit={limit} />
    </Suspense>
  );
}
