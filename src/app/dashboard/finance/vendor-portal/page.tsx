import React from 'react';
import { listVendors } from '@/app/actions/finance/vendor-portal.actions';
import { VendorListClient } from './_components/vendor-portal-list-client';

export default async function VendorPage() {
  const { items, error } = await listVendors();

  return <VendorListClient initialItems={items || []} error={error} />;
}
