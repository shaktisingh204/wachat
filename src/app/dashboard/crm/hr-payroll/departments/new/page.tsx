/**
 * Create department — `/dashboard/crm/hr-payroll/departments/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DepartmentForm>` (also
 * used by Edit). Action: `saveDepartmentAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { DepartmentForm } from '@/app/dashboard/crm/hr-payroll/departments/_components/department-form';

export const dynamic = 'force-dynamic';

export default function NewDepartmentPage() {
  return (
    <EntityDetailShell
      title="New department"
      eyebrow="DEPARTMENT"
      back={{ href: '/dashboard/crm/hr-payroll/departments', label: 'Departments' }}
    >
      <DepartmentForm />
    </EntityDetailShell>
  );
}
