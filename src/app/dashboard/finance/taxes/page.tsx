import React from 'react';
import { listTaxRecords } from '@/app/actions/finance/taxes.actions';
import { TaxRecordListClient } from './_components/taxes-list-client';

export default async function TaxRecordPage() {
  const { items, error } = await listTaxRecords();

  return <TaxRecordListClient initialItems={items || []} error={error} />;
}
