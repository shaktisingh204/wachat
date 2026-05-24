import { getGenerativeAIDrafts } from '@/app/actions/platform/generative-ai-drafter.actions';
import GenerativeAIDrafterClientPage from './client-page';
import { Suspense } from 'react';
import { LoaderCircle } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export const metadata = {
  title: 'Generative AI Drafter | CRM',
};

export default async function GenerativeAIDrafterPage() {
  const drafts = await getGenerativeAIDrafts();

  return (
    <Suspense fallback={
      <EntityListShell title="Generative AI Drafter" subtitle="Draft emails, proposals, and contracts instantly using AI." loading={true}>
        <div className="flex justify-center items-center py-12"><LoaderCircle className="w-8 h-8 animate-spin text-zoru-accent" /></div>
      </EntityListShell>
    }>
      <GenerativeAIDrafterClientPage initialData={drafts} />
    </Suspense>
  );
}
