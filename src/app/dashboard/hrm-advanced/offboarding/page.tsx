'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getOffboardingTasks, saveOffboardingTask, deleteOffboardingTask } from '@/app/actions/hrm-advanced/offboarding';
import { OffboardingTask } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<OffboardingTask>
      title="Offboarding"
      description="Track exit interviews and equipment returns"
      entityName="Task"
      fetchFn={getOffboardingTasks}
      saveFn={saveOffboardingTask}
      deleteFn={deleteOffboardingTask}
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
