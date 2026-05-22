'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getBenefitPlans, saveBenefitPlan, deleteBenefitPlan } from '@/app/actions/hrm-advanced/benefits-portal';
import { BenefitPlan } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<BenefitPlan>
      title="Benefits Portal"
      description="Manage employee benefits and perks"
      entityName="Plan"
      fetchFn={getBenefitPlans}
      saveFn={saveBenefitPlan}
      deleteFn={deleteBenefitPlan}
      formFields={[
      { name: 'name', label: 'Plan Name', type: 'text' },
      { name: 'provider', label: 'Provider', type: 'text' },
      { name: 'coverageDetails', label: 'Coverage Details', type: 'text' },
      { name: 'costToEmployee', label: 'Cost/mo', type: 'number' }
    ]}
      columns={[
      { header: 'Plan Name', accessorKey: 'name' },
      { header: 'Provider', accessorKey: 'provider' },
      { header: 'Cost/mo', accessorKey: 'costToEmployee', render: (val) => `$${val}` }
    ]}
      defaultValues={{ costToEmployee: 0 }}
    />
  );
}
