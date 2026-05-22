'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getOnboardingTasks, saveOnboardingTask, deleteOnboardingTask } from '@/app/actions/hrm-advanced/employee-onboarding';
import { OnboardingTask } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<OnboardingTask>
      title="Employee Onboarding"
      description="Track onboarding tasks for new hires"
      entityName="Task"
      fetchFn={getOnboardingTasks}
      saveFn={saveOnboardingTask}
      deleteFn={deleteOnboardingTask}
      formFields={[
      { name: 'employeeId', label: 'Employee ID', type: 'text' },
      { name: 'taskName', label: 'Task Name', type: 'text' },
      { name: 'dueDate', label: 'Due Date', type: 'date' },
      { name: 'isCompleted', label: 'Completed', type: 'boolean' }
    ]}
      columns={[
      { header: 'Task Name', accessorKey: 'taskName' },
      { header: 'Employee ID', accessorKey: 'employeeId' },
      { header: 'Completed', accessorKey: 'isCompleted', render: (val) => val ? 'Yes' : 'No' },
      { header: 'Due Date', accessorKey: 'dueDate' }
    ]}
      defaultValues={{ isCompleted: false }}
    />
  );
}
