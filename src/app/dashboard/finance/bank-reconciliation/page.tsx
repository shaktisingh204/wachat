import React from 'react';
import { listBankRecons } from '@/app/actions/finance/bank-reconciliation.actions';
import { BankReconListClient } from './_components/bank-reconciliation-list-client';

export default async function BankReconPage() {
  const { items, error } = await listBankRecons();

  return <BankReconListClient initialItems={items || []} error={error} />;
}
