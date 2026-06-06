import React, { Suspense } from 'react';
import { getOKRs } from '@/app/actions/hrm-advanced/okr-tracking';
import { OKRClient } from './okr-client';
import { Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'OKR Tracking | HRM Advanced',
};

export default function OKRTrackingPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">OKR Tracking</h2>
      </div>
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--st-accent)]" />
        </div>
      }>
        <OKRDataLoader />
      </Suspense>
    </div>
  );
}

async function OKRDataLoader() {
  const initialData = await getOKRs();
  return <OKRClient initialData={initialData || []} />;
}
