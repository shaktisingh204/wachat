import React, { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { listTaxRecords } from '@/app/actions/finance/taxes.actions';
import { TaxRecordListClient } from './_components/taxes-list-client';

export const dynamic = 'force-dynamic';

async function TaxRecordPageContainer({ searchParams }: { searchParams: { period?: string } }) {
  const { items, error } = await listTaxRecords({ period: searchParams.period });

  return <TaxRecordListClient initialItems={items || []} error={error} initialPeriod={searchParams.period} />;
}

function TaxRecordPageFallback() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

export default function TaxRecordPage({ searchParams }: { searchParams: { period?: string } }) {
  return (
    <Suspense fallback={<TaxRecordPageFallback />}>
      <TaxRecordPageContainer searchParams={searchParams} />
    </Suspense>
  );
}
