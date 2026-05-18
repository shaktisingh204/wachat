/**
 * Create department — `/dashboard/crm/hr-payroll/departments/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DepartmentForm>` (also
 * used by Edit). Action: `saveDepartmentAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { Building2 } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { DepartmentForm } from '@/app/dashboard/crm/hr-payroll/departments/_components/department-form';

export const dynamic = 'force-dynamic';

export default function NewDepartmentPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New department"
        subtitle="Add an organisational unit."
        icon={Building2}
      />
      <DepartmentForm />
    </div>
  );
}
