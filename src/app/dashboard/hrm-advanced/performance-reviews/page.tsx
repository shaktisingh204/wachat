'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getPerformanceReviews, savePerformanceReview, deletePerformanceReview } from '@/app/actions/hrm-advanced/performance-reviews';
import { PerformanceReview } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<PerformanceReview>
      title="Performance 360 Reviews"
      description="Manage employee performance reviews"
      entityName="Review"
      fetchFn={getPerformanceReviews}
      saveFn={savePerformanceReview}
      deleteFn={deletePerformanceReview}
      formFields={[
      { name: 'employeeId', label: 'Employee ID', type: 'text' },
      { name: 'reviewerId', label: 'Reviewer ID', type: 'text' },
      { name: 'score', label: 'Score (0-5)', type: 'number' },
      { name: 'comments', label: 'Comments', type: 'text' },
      { name: 'reviewDate', label: 'Review Date', type: 'date' }
    ]}
      columns={[
      { header: 'Employee ID', accessorKey: 'employeeId' },
      { header: 'Reviewer ID', accessorKey: 'reviewerId' },
      { header: 'Score', accessorKey: 'score' },
      { header: 'Date', accessorKey: 'reviewDate' }
    ]}
      defaultValues={{ score: 5 }}
    />
  );
}
