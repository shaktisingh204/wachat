import React, { Suspense } from 'react';
import { Skeleton } from '@/components/sabcrm/20ui';
import { listVendors } from '@/app/actions/finance/vendor-portal.actions';
import { VendorListClient } from './_components/vendor-portal-list-client';

export const dynamic = 'force-dynamic';

async function VendorPageContainer() {
  const { items, error } = await listVendors();

  return <VendorListClient initialItems={items || []} error={error} />;
}

export default function VendorPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <Skeleton height={40} width="100%" />
          <Skeleton height={400} width="100%" />
        </div>
      }
    >
      <VendorPageContainer />
    </Suspense>
  );
}
