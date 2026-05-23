/**
 * Create designation — `/dashboard/hrm/payroll/designations/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DesignationForm>` (also
 * used by Edit). Action: `saveDesignationAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { DesignationForm } from '@/app/dashboard/hrm/payroll/designations/_components/designation-form';

export const dynamic = 'force-dynamic';

export default function NewDesignationPage() {
  return (
    <EntityListShell
      title="New designation"
      subtitle="Add a role."
    >
      <DesignationForm />
    </EntityListShell>
  );
}
