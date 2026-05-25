import React, { Suspense } from 'react';
import { Skeleton } from '@/components/zoruui';
import { listTaxRecords } from '@/app/actions/finance/taxes.actions';
import { TaxRecordListClient } from './_components/taxes-list-client';

export const dynamic = 'force-dynamic';

async function TaxRecordPageContainer({ searchParams }: { searchParams: { period?: string } }) {
  const { items, error } = await listTaxRecords({ period: searchParams.period });

  return <TaxRecordListClient initialItems={items || []} error={error} initialPeriod={searchParams.period} />;
}

export default function TaxRecordPage({ searchParams }: { searchParams: { period?: string } }) {
  return (
    <Suspense fallback={<div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-[400px] w-full" /></div>}>
      <TaxRecordPageContainer searchParams={searchParams} />
    </Suspense>
  );
}
