/**
 * Create designation — `/dashboard/hrm/payroll/designations/new` (canonical).
 *
 * Server-component shell wrapping the shared `<DesignationForm>` (also
 * used by Edit). Action: `saveDesignationAction` (Rust client), redirects
 * to the canonical list on success.
 */

import { BadgeCheck } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { DesignationForm } from '@/app/dashboard/crm/hr-payroll/designations/_components/designation-form';

export const dynamic = 'force-dynamic';

export default function NewDesignationPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New designation"
        subtitle="Add a role."
        icon={BadgeCheck}
      />
      <DesignationForm />
    </div>
  );
}
