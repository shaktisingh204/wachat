import { Suspense } from 'react';
import { listGlEntrys } from '@/app/actions/finance/gl.actions';
import { GlEntryListClient } from './_components/gl-list-client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

async function GlEntryListContainer() {
  const { items, error } = await listGlEntrys();
  return <GlEntryListClient initialItems={items || []} error={error} />;
}

function GlEntryFallback() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton height={40} className="w-full" />
      <Skeleton height={400} className="w-full" />
    </div>
  );
}

export default function GlEntryPage() {
  return (
    <Suspense fallback={<GlEntryFallback />}>
      <GlEntryListContainer />
    </Suspense>
  );
}
