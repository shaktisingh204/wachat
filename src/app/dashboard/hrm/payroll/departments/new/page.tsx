/**
 * Create department — `/dashboard/hrm/payroll/departments/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DepartmentForm>` (also
 * used by Edit). Action: `saveDepartmentAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DepartmentForm } from '@/app/dashboard/crm/hr-payroll/departments/_components/department-form';

export const dynamic = 'force-dynamic';

export default function NewDepartmentPage() {
  return (
    <EntityListShell
      title="New department"
      subtitle="Add an organisational unit."
    >
      <DepartmentForm />
    </EntityListShell>
  );
}
