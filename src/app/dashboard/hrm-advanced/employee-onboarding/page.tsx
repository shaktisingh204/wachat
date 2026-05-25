import React, { Suspense } from 'react';
import { getOnboardingTasks } from '@/app/actions/hrm-advanced/employee-onboarding';
import { OnboardingPageClient } from './_components/onboarding-page-client';
import Loading from './loading';

export const dynamic = 'force-dynamic';


export const metadata = {
  title: 'Employee Onboarding',
  description: 'Track onboarding tasks for new hires',
};

async function OnboardingDataLoader() {
  const result = await getOnboardingTasks();
  
  const tasks = Array.isArray(result) ? result : [];

  return <OnboardingPageClient initialTasks={tasks} />;
}

export default function Page() {
  return (
    <div className="w-full">
      <Suspense fallback={<Loading />}>
        <OnboardingDataLoader />
      </Suspense>
    </div>
  );
}
