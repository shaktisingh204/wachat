import React, { Suspense } from 'react';
import { listGlEntrys } from '@/app/actions/finance/gl.actions';
import { GlEntryListClient } from './_components/gl-list-client';
import { Skeleton } from '@/components/zoruui';

export const dynamic = 'force-dynamic';

async function GlEntryListContainer() {
  const { items, error } = await listGlEntrys();
  return <GlEntryListClient initialItems={items || []} error={error} />;
}

export default function GlEntryPage() {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <GlEntryListContainer />
    </Suspense>
  );
}
