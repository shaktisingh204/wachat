'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getOKRs, saveOKR, deleteOKR } from '@/app/actions/hrm-advanced/okr-tracking';
import { OKR } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<OKR>
      title="OKR Tracking"
      description="Track Objectives and Key Results"
      entityName="OKR"
      fetchFn={getOKRs}
      saveFn={saveOKR}
      deleteFn={deleteOKR}
      formFields={[
      { name: 'objective', label: 'Objective', type: 'text' },
      { name: 'keyResult', label: 'Key Result', type: 'text' },
      { name: 'progress', label: 'Progress %', type: 'number' },
      { name: 'ownerId', label: 'Owner ID', type: 'text' },
      { name: 'quarter', label: 'Quarter', type: 'text' }
    ]}
      columns={[
      { header: 'Objective', accessorKey: 'objective' },
      { header: 'Key Result', accessorKey: 'keyResult' },
      { header: 'Progress', accessorKey: 'progress', render: (val) => `${val}%` },
      { header: 'Quarter', accessorKey: 'quarter' }
    ]}
      defaultValues={{ progress: 0 }}
    />
  );
}
