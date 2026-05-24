import React from 'react';
import { listTaxRecords } from '@/app/actions/finance/taxes.actions';
import { TaxRecordListClient } from './_components/taxes-list-client';

export default async function TaxRecordPage({ searchParams }: { searchParams: { period?: string } }) {
  const { items, error } = await listTaxRecords({ period: searchParams.period });

  return <TaxRecordListClient initialItems={items || []} error={error} initialPeriod={searchParams.period} />;
}
