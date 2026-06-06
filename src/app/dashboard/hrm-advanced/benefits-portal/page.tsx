import React, { Suspense } from 'react';
import { getBenefitPlans } from '@/app/actions/hrm-advanced/benefits-portal';
import BenefitsPortalClient from './client';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

export default function BenefitsPortalPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--st-text)]">Benefits Portal</h2>
          <p className="text-[var(--st-text-secondary)]">Manage employee benefits, perks, and track costs.</p>
        </div>
      </div>
      
      <Suspense fallback={
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      }>
        <DataLoader />
      </Suspense>
    </div>
  );
}

async function DataLoader() {
  const initialData = await getBenefitPlans();
  return <BenefitsPortalClient initialData={initialData || []} />;
}
