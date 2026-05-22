'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getTrainingCourses, saveTrainingCourse, deleteTrainingCourse } from '@/app/actions/hrm-advanced/lms-training';
import { TrainingCourse } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<TrainingCourse>
      title="LMS & Training"
      description="Manage corporate training courses"
      entityName="Course"
      fetchFn={getTrainingCourses}
      saveFn={saveTrainingCourse}
      deleteFn={deleteTrainingCourse}
      formFields={[
      { name: 'title', label: 'Title', type: 'text' },
      { name: 'description', label: 'Description', type: 'text' },
      { name: 'enrolledCount', label: 'Enrolled Count', type: 'number' },
      { name: 'durationHours', label: 'Duration (hrs)', type: 'number' }
    ]}
      columns={[
      { header: 'Title', accessorKey: 'title' },
      { header: 'Description', accessorKey: 'description' },
      { header: 'Enrolled', accessorKey: 'enrolledCount' },
      { header: 'Duration (hrs)', accessorKey: 'durationHours' }
    ]}
      defaultValues={{ enrolledCount: 0, durationHours: 1 }}
    />
  );
}
