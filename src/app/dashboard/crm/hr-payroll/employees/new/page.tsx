/**
 * Create employee — `/dashboard/crm/hr-payroll/employees/new`.
 *
 * Server component: fetches the tenant's employee custom-field
 * definitions once, then hands off to the shared `<EmployeeForm>`
 * (also used by Edit).
 */

import { Users } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { getCustomFieldsFor } from '@/app/actions/worksuite/meta.actions';
import { EmployeeForm } from '../_components/employee-form';
import type { WsCustomField } from '@/lib/worksuite/meta-types';

export const dynamic = 'force-dynamic';

export default async function NewEmployeePage() {
  const customFields = (await getCustomFieldsFor('employee')) as WsCustomField[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New employee"
        subtitle="Onboard a new team member."
        icon={Users}
      />
      <EmployeeForm customFields={customFields} />
    </div>
  );
}
