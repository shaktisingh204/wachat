import React, { Suspense } from 'react';
import { getOffboardingTasks, saveOffboardingTask, deleteOffboardingTask } from '@/app/actions/hrm-advanced/offboarding';
import { OffboardingClient } from './components/OffboardingClient';
import { OffboardingTask } from '@/lib/hrm-advanced-types';

export const dynamic = 'force-dynamic';


async function OffboardingDataWrapper() {
  const initialTasks = await getOffboardingTasks();
  return (
    <OffboardingClient 
      initialTasks={initialTasks as OffboardingTask[]}
      onSaveTask={saveOffboardingTask}
      onDeleteTask={deleteOffboardingTask}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse text-zoru-text-secondary">Loading offboarding data...</div>}>
      <OffboardingDataWrapper />
    </Suspense>
  );
}
