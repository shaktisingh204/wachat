import React, { Suspense } from 'react';
import { getATSApplications } from '@/app/actions/hrm-advanced/ats-recruitment';
import ClientPage from './_components/ClientPage';
import { Skeleton } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'ATS Recruitment | SabNode',
  description: 'Manage job applications and candidates with advanced features.',
};

export default async function Page() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">ATS Recruitment</h2>
      </div>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>}>
        <ApplicationsLoader />
      </Suspense>
    </div>
  );
}

async function ApplicationsLoader() {
  const initialData = await getATSApplications();
  return <ClientPage initialData={initialData} />;
}
