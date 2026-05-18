/**
 * Create designation — `/dashboard/crm/hr-payroll/designations/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DesignationForm>` (also
 * used by Edit). Action: `saveDesignationAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { DesignationForm } from '@/app/dashboard/crm/hr-payroll/designations/_components/designation-form';

export const dynamic = 'force-dynamic';

export default function NewDesignationPage() {
  return (
    <EntityDetailShell
      title="New designation"
      eyebrow="DESIGNATION"
      back={{ href: '/dashboard/crm/hr-payroll/designations', label: 'Designations' }}
    >
      <DesignationForm />
    </EntityDetailShell>
  );
}
