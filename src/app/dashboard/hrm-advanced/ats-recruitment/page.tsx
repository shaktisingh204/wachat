'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getATSApplications, saveATSApplication, deleteATSApplication } from '@/app/actions/hrm-advanced/ats-recruitment';
import { ATSApplication } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<ATSApplication>
      title="ATS Recruitment"
      description="Manage job applications and candidates"
      entityName="Application"
      fetchFn={getATSApplications}
      saveFn={saveATSApplication}
      deleteFn={deleteATSApplication}
      formFields={[
      { name: 'candidateName', label: 'Candidate Name', type: 'text' },
      { name: 'role', label: 'Role', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'] },
      { name: 'appliedDate', label: 'Applied Date', type: 'date' }
    ]}
      columns={[
      { header: 'Candidate', accessorKey: 'candidateName' },
      { header: 'Role', accessorKey: 'role' },
      { header: 'Status', accessorKey: 'status' },
      { header: 'Applied Date', accessorKey: 'appliedDate' }
    ]}
      defaultValues={{ status: 'New' }}
    />
  );
}
