export const dynamic = 'force-dynamic';

import React, { Suspense } from 'react';
import BillingClient from './billing-client';

export default async function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingClient />
    </Suspense>
  );
}
